import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPlan, planForDate, buildProposal, validatePlan } from '../js/plans.js';
import { validateChat, reviewContext } from '../js/coach-policy.js';
import { validateOperations, modelResponse, handleRequest } from '../supabase/functions/coach/service.js';
import { advise } from '../js/progression.js';
import { safeDay, recordError } from '../js/records.js';

const change = { dayKey: 'barra-a', slotId: 'barra-a:agacho', sets: 3, reason: 'Disponibilidade informada.', evidenceIds: ['feedback-1'] };
const input = (changes = [change]) => ({ effectiveFrom: '2026-09-20', summary: 'Ajuste da próxima semana.', changes });
test('programa inicial válido e versões não modificam o original', () => {
  const base = initialPlan();
  assert.equal(validatePlan(base), null);
  const proposed = buildProposal(base, input(), { id: 'new' });
  assert.equal(base.days['barra-a'].slots[0].sets, 4);
  assert.equal(proposed.days['barra-a'].slots[0].sets, 3);
  assert.equal(planForDate([base, proposed], '2026-09-20').id, base.id);
  proposed.status = 'applied';
  assert.equal(planForDate([base, proposed], '2026-09-19').id, base.id);
  assert.equal(planForDate([base, proposed], '2026-09-20').id, 'new');
});
test('rejeita salto excessivo, exercício desconhecido e evidência ausente', () => {
  for (const patch of [{ sets: 1 }, { exerciseId: 'inventado' }, { evidenceIds: [] }, { rpe: 10 }, { loadFactor: 1.2 }]) {
    assert.throws(() => buildProposal(initialPlan(), input([{ ...change, ...patch }]), { id: 'new' }));
  }
});
test('redução de carga tem validade e não se propaga para nova semana', () => {
  const plan = buildProposal(initialPlan(), input([{ ...change, loadFactor: 0.9 }]), { id: 'new' });
  assert.equal(plan.days['barra-a'].slots[0].loadUntil, '2026-09-26');
  const next = buildProposal(plan, { ...input([]), effectiveFrom: '2026-09-27' }, { id: 'next' });
  assert.equal(next.days['barra-a'].slots[0].loadFactor, undefined);
});
test('agenda não pode repetir sessões de força', () => {
  assert.throws(() => buildProposal(initialPlan(), { ...input([]), weekdays: ['barra-a','barra-a','off','off','off','off','off'] }, { id: 'new' }));
});
test('memória expirada e registros futuros ficam fora da análise', () => {
  const context = reviewContext({ plans: [initialPlan()], logs: [], memories: [{ id: 'past', validUntil: '2026-09-01' }, { id: 'future', validFrom: '2026-10-01' }, { id: 'valid' }] }, '2026-09-15');
  assert.deepEqual(context.memories.map((m) => m.id), ['valid']);
  assert.ok(context.signals.every((x) => x.trend.insufficient));
  assert.equal(context.targetWeek, '2026-09-20');
});
test('resposta de conversa e operações de cliente são validadas', () => {
  assert.throws(() => validateChat({ kind: 'applied', text: 'Treino aplicado.', options: [] }));
  assert.throws(() => validateOperations([{ kind: 'plans', id: 'x', opId: 'o', value: { id: 'x' }, baseRevision: 0, deleted: false }]));
  assert.throws(() => validateOperations([{ kind: 'messages', id: 'x', opId: 'o', value: { id: 'x', role: 'assistant' }, baseRevision: 0, deleted: false }]));
});
test('recusa ou resposta incompleta da IA nunca vira proposta', async () => {
  for (const body of [{ status: 'incomplete' }, { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }]) {
    await assert.rejects(() => modelResponse({}, 'test', '', {}, { openaiKey: 'secret', model: 'configured' }, async () => Response.json(body)));
  }
});
test('chamada sem configuração ou sem autenticação não acessa os dados', async () => {
  const request = () => new Request('https://example.com', { method: 'POST', body: JSON.stringify({ action: 'sync' }) });
  assert.equal((await handleRequest(request(), {})).status, 503);
  assert.equal((await handleRequest(request(), { supabaseUrl: 'https://project.supabase.co', serviceKey: 'server', allowedUser: 'u', origin: 'https://app.test' })).status, 401);
});
test('RPE legado não dispara aumento dobrado ou fadiga confirmada', () => {
  const slot = initialPlan().days['barra-a'].slots[0];
  const logs = ['2026-09-06','2026-09-13'].flatMap((date) => Array.from({ length:4 },(_,i) => ({ id:date+i,date,dayKey:'barra-a',exerciseId:'agacho',weight:100,reps:4,rpe:6,rpeSource:'legacy-unknown' })));
  assert.equal(advise(slot,logs,'2026-09-20',false,'barra-a').weight,105);
});
test('prescrições sincronizadas não podem injetar HTML', () => {
  assert.ok(recordError('memories',{ id:'x"><img>',text:'x' }));
  const day = structuredClone(initialPlan().days['barra-a']);
  day.name = '<script>'; day.mobility = [{ name:'bad',url:'javascript:bad' }];
  assert.equal(safeDay('barra-a',day).name,'Barra A — Agacho pesado');
  day.slots[0].sets = '<img>';
  assert.throws(() => safeDay('barra-a',day));
});
