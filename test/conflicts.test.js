import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { connectionHTML } from '../js/views/connection.js';

const conflict = (id, weight) => ({ kind: 'logs', id, deleted: false, revision: 7,
  value: { id, date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight, reps: 4, rpe: 8, createdAt: 1, isDeload: false } });

test('os botões de conflito endereçam o registro, não a posição na lista', async () => {
  await db.ready();
  await db.setLocal('syncConflicts', [conflict('set-a', 100), conflict('set-b', 120)]);
  const html = await connectionHTML();
  // A sincronização de fundo reescreve syncConflicts; um índice apontaria para outro registro.
  assert.match(html, /data-conflict-kind="logs" data-conflict-id="set-a" data-choice="local"/);
  assert.match(html, /data-conflict-kind="logs" data-conflict-id="set-b" data-choice="remote"/);
  assert.doesNotMatch(html, /data-conflict="\d+"/);
});

test('o conflito mostra a versão local ao lado da do servidor', async () => {
  await db.ready();
  await db.putRecord('logs', { id: 'set-a', date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 95, reps: 4, rpe: 8, createdAt: 1, isDeload: false });
  await db.setLocal('syncConflicts', [conflict('set-a', 100)]);
  const html = await connectionHTML();
  assert.match(html, /Deste aparelho/);
  assert.match(html, /&quot;weight&quot;: 95/);
  assert.match(html, /Do servidor/);
  assert.match(html, /&quot;weight&quot;: 100/);
});

test('preservar as duas mantém o remoto no id original e cria cópia local sincronizável', async () => {
  await db.wipeAll();
  await db.putRecord('logs', { id: 'set-both', date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 95, reps: 4, rpe: 8, createdAt: 1, isDeload: false });
  await db.setLocal('syncConflicts', [conflict('set-both', 100)]);
  await db.resolveConflict('logs', 'set-both', 'both');
  const logs = await db.getLogs();
  assert.equal(logs.length, 2);
  assert.equal(logs.find((x) => x.id === 'set-both').weight, 100);
  const copy = logs.find((x) => x.id !== 'set-both');
  assert.equal(copy.weight, 95);
  assert.ok((await db.pendingOperations()).some((x) => x.id === copy.id));
  assert.deepEqual(await db.getLocal('syncConflicts'), []);
});

test('configuração oferece preservar ambas apenas para registros independentes', async () => {
  await db.wipeAll();
  await db.putRecord('logs', { id: 'set-safe', date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 95, reps: 4, rpe: 8, createdAt: 1, isDeload: false });
  await db.setLocal('syncConflicts', [conflict('set-safe', 100), { kind:'settings', id:'main', value:{ id:'main', units:{} }, deleted:false, revision:2 }]);
  const html = await connectionHTML();
  assert.equal((html.match(/data-choice="both"/g) ?? []).length, 1);
});

const serie = (weight) => ({ id: 'set-noise', date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight, reps: 4, rpe: 8, createdAt: 1, isDeload: false });

test('divergência só de updatedAt não vira pergunta', async () => {
  await db.wipeAll();
  const saved = await db.putRecord('logs', serie(100));
  // O servidor devolve o mesmo conteúdo com outro carimbo e outra ordem de chaves, como o jsonb faz.
  const remote = Object.fromEntries(Object.entries({ ...saved, updatedAt: saved.updatedAt + 5000 }).reverse());
  await db.acceptSync({ acknowledgements: [], changes: [], cursor: 1, conflicts: [{ kind: 'logs', id: 'set-noise', value: remote, deleted: false, revision: 9 }] });
  assert.deepEqual(await db.getLocal('syncConflicts'), []);
  assert.deepEqual(await db.pendingOperations(), []);
  assert.equal((await db.getLogs())[0].weight, 100);
});

test('divergência de conteúdo continua exigindo decisão', async () => {
  await db.wipeAll();
  await db.putRecord('logs', serie(100));
  const disputed = await db.acceptSync({ acknowledgements: [], changes: [], cursor: 1, conflicts: [{ kind: 'logs', id: 'set-noise', value: serie(120), deleted: false, revision: 9 }] });
  assert.equal(disputed.length, 1);
  assert.equal((await db.getLocal('syncConflicts')).length, 1);
  assert.equal((await db.pendingOperations()).length, 1);
});

test('regravar o mesmo conteúdo não enfileira operação nova', async () => {
  await db.wipeAll();
  await db.putRecord('logs', serie(100));
  await db.acceptSync({ acknowledgements: [{ kind: 'logs', id: 'set-noise', opId: (await db.pendingOperations())[0].opId, revision: 1 }], changes: [], cursor: 1, conflicts: [] });
  assert.deepEqual(await db.pendingOperations(), []);
  await db.putRecord('logs', serie(100));
  assert.deepEqual(await db.pendingOperations(), []);
  await db.putRecord('logs', serie(105));
  assert.equal((await db.pendingOperations()).length, 1);
});

test('dois aparelhos gravando o mesmo treino não viram 120 perguntas', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFile } = await import('node:fs/promises');
  const { initialPlan } = await import('../js/plans.js');
  const pg = new PGlite();
  const user = '11111111-1111-4111-8111-111111111111';
  await pg.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  await pg.exec(await readFile(new URL('../supabase/migrations/202609150001_coach.sql', import.meta.url), 'utf8'));
  await pg.query('insert into auth.users values($1)', [user]);
  const call = async (name, params) => (await pg.query('select public.coach_' + name + '(' + params.map((_, i) => '$' + (i+1)).join(',') + ') result', params)).rows[0].result;
  try {
    await call('bootstrap', [user, initialPlan()]);
    await db.wipeAll();
    const serieN = (i) => ({ id: 'set-' + i, date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 100, reps: 4, rpe: 8, createdAt: 1, isDeload: false });
    for (let i = 0; i < 120; i++) await db.putRecord('logs', serieN(i));
    // O outro aparelho já subiu as mesmas séries: mesmo conteúdo, outro carimbo de gravação.
    for (let i = 0; i < 120; i++) await call('write', [user, 'logs', 'set-' + i, { ...serieN(i), updatedAt: 1 }, false]);

    let cursor = 0;
    for (let round = 0; round < 10 && (await db.pendingOperations()).length; round++) {
      const operations = (await db.pendingOperations()).slice(0, 100);
      const result = await call('sync', [user, operations, cursor]);
      cursor = result.cursor;
      await db.acceptSync(result);
    }
    assert.deepEqual(await db.getLocal('syncConflicts'), [], 'nenhuma pergunta deveria sobrar');
    assert.deepEqual(await db.pendingOperations(), [], 'a fila deveria drenar por completo');
    assert.equal((await db.getLogs()).length, 120);
  } finally { await pg.close(); }
});
