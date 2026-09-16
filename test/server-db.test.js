import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialPlan, buildProposal } from '../js/plans.js';

const pg = new PGlite();
await pg.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
await pg.exec(await readFile(new URL('../supabase/migrations/202609150001_coach.sql', import.meta.url), 'utf8'));
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
await pg.query('insert into auth.users values($1),($2)', [user, other]);
const call = async (name, params) => (await pg.query('select public.coach_' + name + '(' + params.map((_, i) => '$' + (i+1)).join(',') + ') result', params)).rows[0].result;
const op = (id, text, revision = 0, opId = id) => ({ kind: 'memories', id, opId, baseRevision: revision, deleted: false, value: { id, text } });
after(() => pg.close());

test('bootstrap e sincronização repetida não duplicam registros', async () => {
  await call('bootstrap', [user, initialPlan()]);
  const first = await call('sync', [user, [op('one','A')], 0]);
  const second = await call('sync', [user, [op('one','A')], first.cursor]);
  assert.deepEqual(first.acknowledgements, second.acknowledgements);
  assert.equal((await call('bundle', [user])).data.memories.length, 1);
});
test('detecta conflito e impede escrita de mensagens do agente', async () => {
  const result = await call('sync', [user, [op('one','B',0,'new-op')], 0]);
  assert.equal(result.conflicts.length, 1);
  await assert.rejects(() => call('sync', [user, [{ ...op('evil','x'), kind: 'messages', value: { id:'evil', role:'assistant' } }], 0]));
});
test('RLS impede outra conta de ler os registros', async () => {
  await pg.exec('grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;');
  await pg.exec('set role authenticated');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  assert.equal((await pg.query('select * from coach_records')).rows.length, 0);
  await assert.rejects(() => call('bundle', [user]));
  await pg.exec('reset role');
});
test('aplicação é idempotente e rejeita proposta baseada em dados antigos', async () => {
  const { revision } = await call('bundle', [user]);
  const plan = buildProposal(initialPlan(), { effectiveFrom: '2099-09-20', summary: 'Semana ajustada', changes: [] }, { id:'test-plan' });
  const review = { id:'review', planId:plan.id, status:'proposed', createdAt:Date.now() };
  await call('commit_review', [user, review, plan, revision]);
  const first = await call('decide', [user, review.id, true]);
  const second = await call('decide', [user, review.id, true]);
  assert.deepEqual(first, second); assert.equal(first.status, 'applied');
  const plan2 = { ...plan, id:'stale-plan', parentId:plan.id };
  await call('commit_review', [user, { ...review, id:'stale-review', planId:plan2.id }, plan2, revision]);
  await call('sync', [user, [op('two','Novo feedback')], 0]);
  await assert.rejects(() => call('decide', [user, 'stale-review', true]), /desatualizada/);
});
test('trabalho repetido retorna resultado persistido', async () => {
  assert.equal((await call('claim_job', [user,'job','converse',40])).cached, false);
  await assert.rejects(() => call('claim_job',[user,'job','converse',40]), /andamento/);
  await call('finish_job',[user,'job',{ text:'Pronto' },false]);
  assert.deepEqual(await call('claim_job',[user,'job','converse',40]), { cached:true, result:{ text:'Pronto' } });
});
test('resposta calculada sobre contexto antigo não é publicada', async () => {
  const bundle = await call('bundle',[user]);
  await call('sync',[user,[op('new-context','Disponibilidade mudou')],0]);
  const reply = { id:'reply-stale',role:'assistant',text:'Contexto antigo' };
  await assert.rejects(() => call('commit_reply',[user,reply,bundle.revision]), /atualizado/);
  assert.ok(!(await call('bundle',[user])).data.messages);
});
test('agendamento é atômico e não duplica conversa ou pergunta', async () => {
  const conversation = { id:'scheduled-test',title:'Revisão',date:'2026-09-16' };
  const reply = { id:'scheduled-question',conversationId:conversation.id,role:'assistant',text:'Como será a semana?' };
  await call('schedule',[user,conversation,reply]);
  await call('schedule',[user,conversation,reply]);
  const bundle = await call('bundle',[user]);
  assert.equal(bundle.data.conversations.length,1);
  assert.equal(bundle.data.messages.length,1);
});
test('restaura planos em conta vazia, mas não sobrescreve conta populada', async () => {
  await call('bootstrap',[other,initialPlan()]);
  const plan = { ...initialPlan(),id:'restored-plan',createdAt:1,summary:'Plano restaurado' };
  await call('adopt',[other,[initialPlan(),plan],[]]);
  assert.equal((await call('bundle',[other])).data.plans.length,2);
  await assert.rejects(() => call('adopt',[user,[plan],[]]), /já contém/);
});
test('exclusão remota impede aparelho antigo de ressuscitar dados', async () => {
  const synced = await call('sync',[user,[],0]);
  await call('erase',[user]);
  await call('bootstrap',[user,initialPlan()]);
  await assert.rejects(() => call('sync',[user,[op('resurrect','Antigo')],synced.cursor,synced.epoch]), /excluídos/);
  assert.ok(!(await call('bundle',[user])).data.memories);
});
