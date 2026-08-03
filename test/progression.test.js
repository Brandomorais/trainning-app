/*
 * Testes do algoritmo de sugestão (progression.js) — funções puras.
 * Roda com `npm test` (node --test, sem dependências).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advise,
  cycleWeek,
  deloadAdvice,
  workTopWeight,
  lastTopSummary,
  addDaysISO,
} from '../js/progression.js';

/* ---------- Helpers de fixture ---------- */
let idSeq = 0;
/** Série de log mínima; weight em kg. */
function set(date, exerciseId, weight, reps, { rpe = null, dayKey = 'barra-a', isDeload = false } = {}) {
  return { id: String(++idSeq), date, dayKey, exerciseId, setNumber: 1, weight, reps, rpe, isDeload, createdAt: ++idSeq };
}

/** N séries iguais na mesma data. */
function sets(n, date, exerciseId, weight, reps, opts = {}) {
  return Array.from({ length: n }, () => set(date, exerciseId, weight, reps, opts));
}

const AG = { exerciseId: 'agacho', sets: 4, reps: 4, rpe: 8, rest: '3-5min', ramp: true }; // increment 5
const REM = { exerciseId: 'remada-curvada', sets: 4, reps: 8, rest: '90s-2min' }; // accessory repRange [8,12]

/* ---------- workTopWeight ---------- */

test('workTopWeight ignora feeler single acima do trabalho', () => {
  const s = [...sets(4, '2026-07-05', 'agacho', 100, 4), set('2026-07-05', 'agacho', 110, 1)];
  assert.equal(workTopWeight(s), 100);
});

test('workTopWeight cai no mais pesado quando só há singles', () => {
  const s = [set('2026-07-05', 'terra', 120, 3), set('2026-07-05', 'terra', 130, 3)];
  assert.equal(workTopWeight(s), 130);
});

/* ---------- advise: histórico e deload ---------- */

test('pós-deload: sessão de deload não vira base da sugestão', () => {
  const logs = [
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 8 }),
    ...sets(2, '2026-07-12', 'agacho', 60, 4, { isDeload: true }),
  ];
  const adv = advise(AG, logs, '2026-07-19', false, 'barra-a');
  assert.equal(adv.weight, 105); // 100 + incremento 5, não 60 + 5
});

test('semana de deload sugere 60% do topo de trabalho não-deload', () => {
  const logs = [...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 8 })];
  const adv = advise(AG, logs, '2026-07-12', true, 'barra-a');
  assert.equal(adv.weight, 60);
});

test('feeler single não conta como falha nem base de incremento', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'agacho', 100, 4, { rpe: 8 }),
    // trabalho ok em 100, mas single de 110 falhou as reps prescritas:
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 8 }),
    set('2026-07-05', 'agacho', 110, 1, { rpe: 10 }),
  ];
  const adv = advise(AG, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 105); // base 100 (+5), sem status de falha
  assert.notEqual(adv.status, 'estagnado');
});

/* ---------- advise: modulação por RPE ---------- */

test('RPE fácil em 1 sessão só NÃO dobra o incremento', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'agacho', 95, 4, { rpe: 8 }),
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 6 }),
  ];
  const adv = advise(AG, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 105); // +5, não +10
});

test('RPE fácil nas 2 últimas sessões dobra o incremento', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'agacho', 95, 4, { rpe: 6 }),
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 6 }),
  ];
  const adv = advise(AG, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 110); // +10
});

test('RPE ≥ alvo+1 segura a carga', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'agacho', 95, 4, { rpe: 8 }),
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 9 }),
  ];
  const adv = advise(AG, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 100);
  assert.equal(adv.status, 'atencao');
});

test('RPE ≥ alvo+2 recua um degrau', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'agacho', 95, 4, { rpe: 8 }),
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 10 }),
  ];
  const adv = advise(AG, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 97.5);
  assert.equal(adv.status, 'atencao');
});

/* ---------- advise: acessórios ---------- */

test('acessório no teto de reps sobe a carga', () => {
  const logs = sets(4, '2026-07-05', 'remada-curvada', 60, 12);
  const adv = advise(REM, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 62.5);
});

test('acessório abaixo do piso 2 sessões seguidas recua 10%', () => {
  const logs = [
    ...sets(4, '2026-06-28', 'remada-curvada', 60, 7),
    ...sets(4, '2026-07-05', 'remada-curvada', 60, 6),
  ];
  const adv = advise(REM, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.weight, 55); // 60 × 0,9 = 54 → grade 2,5 = 55
  assert.equal(adv.status, 'estagnado');
});

test('acessório 4 sessões sem somar reps vira atenção', () => {
  const logs = [
    ...sets(4, '2026-06-14', 'remada-curvada', 60, 10),
    ...sets(4, '2026-06-21', 'remada-curvada', 60, 10),
    ...sets(4, '2026-06-28', 'remada-curvada', 60, 10),
    ...sets(4, '2026-07-05', 'remada-curvada', 60, 10),
  ];
  const adv = advise(REM, logs, '2026-07-12', false, 'barra-a');
  assert.equal(adv.status, 'atencao');
  assert.equal(adv.weight, 60);
});

/* ---------- cycleWeek híbrido ---------- */

const CYCLE = { startDate: '2026-07-05' }; // domingo

test('sem deloadStart: módulo intacto (semana 5 = deload, recomeço na 1)', () => {
  assert.deepEqual(cycleWeek(CYCLE, '2026-07-05'), { week: 1, deload: false });
  assert.deepEqual(cycleWeek(CYCLE, '2026-08-02'), { week: 5, deload: true });
  assert.deepEqual(cycleWeek(CYCLE, '2026-08-09'), { week: 1, deload: false });
});

test('deload antecipado: janela de 7 dias e recomeço lazy na semana 1', () => {
  const c = { startDate: '2026-07-05', deloadStart: '2026-07-29' }; // meio da semana 4
  assert.equal(cycleWeek(c, '2026-07-28').deload, false); // véspera
  assert.equal(cycleWeek(c, '2026-07-29').deload, true);
  assert.equal(cycleWeek(c, '2026-08-04').deload, true); // último dia da janela
  assert.deepEqual(cycleWeek(c, '2026-08-05'), { week: 1, deload: false });
  // módulo default volta a valer no ciclo seguinte:
  assert.equal(cycleWeek(c, addDaysISO('2026-08-05', 28)).deload, true);
});

test('deload adiado: semana 5 vira treino marcado como adiado, deload na 6ª', () => {
  const c = { startDate: '2026-07-05', deloadStart: '2026-08-09' }; // 6ª semana
  const wk5 = cycleWeek(c, '2026-08-02');
  assert.deepEqual(wk5, { week: 5, deload: false, delayed: true });
  assert.equal(cycleWeek(c, '2026-08-09').deload, true);
  assert.deepEqual(cycleWeek(c, '2026-08-16'), { week: 1, deload: false });
});

/* ---------- deloadAdvice ---------- */

/*
 * Fixture de fadiga: agacho e terra com e1RM estancado há 4 sessões
 * (status 'estagnado' pelo stalled4) nos seus dias pesados.
 */
function fatiguedLogs(weeks = 4) {
  const logs = [];
  for (let i = 0; i < weeks; i++) {
    const sunday = addDaysISO('2026-07-05', i * 7);
    logs.push(...sets(4, sunday, 'agacho', 100, 4, { rpe: 8, dayKey: 'barra-a' }));
    logs.push(...sets(4, addDaysISO(sunday, 3), 'terra', 140, 3, { rpe: 8, dayKey: 'barra-b' }));
  }
  return logs;
}

test('deloadAdvice: nada antes da semana 4, mesmo com fadiga', () => {
  const logs = fatiguedLogs(3);
  assert.equal(deloadAdvice(logs, CYCLE, '2026-07-25'), null); // semana 3
});

test('deloadAdvice: antecipar na semana 4 com ≥2 básicos ruins e ≥1 estagnado', () => {
  const logs = fatiguedLogs(4);
  const advice = deloadAdvice(logs, CYCLE, '2026-07-29'); // semana 4
  assert.equal(advice?.type, 'antecipar');
  assert.equal(advice.deloadStart, '2026-07-29');
  assert.ok(advice.signals.length >= 2);
});

test('deloadAdvice: sem fadiga não antecipa', () => {
  const logs = [
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-12', 'agacho', 105, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-19', 'agacho', 110, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-26', 'agacho', 115, 4, { rpe: 8, dayKey: 'barra-a' }),
  ];
  assert.equal(deloadAdvice(logs, CYCLE, '2026-07-29'), null);
});

test('deloadAdvice: semana 5 limpa oferece adiar para a 6ª', () => {
  const logs = [
    ...sets(4, '2026-07-05', 'agacho', 100, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-12', 'agacho', 105, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-19', 'agacho', 110, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(4, '2026-07-26', 'agacho', 115, 4, { rpe: 8, dayKey: 'barra-a' }),
  ];
  const advice = deloadAdvice(logs, CYCLE, '2026-08-03'); // semana 5 (deload default)
  assert.equal(advice?.type, 'adiar');
  assert.equal(advice.deloadStart, '2026-08-09'); // início da 6ª semana
});

test('deloadAdvice: série de deload já registrada na semana suprime o adiar', () => {
  const logs = [
    ...sets(4, '2026-07-26', 'agacho', 115, 4, { rpe: 8, dayKey: 'barra-a' }),
    ...sets(2, '2026-08-02', 'agacho', 70, 4, { isDeload: true, dayKey: 'barra-a' }),
  ];
  assert.equal(deloadAdvice(logs, CYCLE, '2026-08-03'), null);
});

test('deloadAdvice: intervenção pendente não gera segunda oferta (teto na 6ª)', () => {
  const c = { startDate: '2026-07-05', deloadStart: '2026-08-09' }; // já adiado
  assert.equal(deloadAdvice([], c, '2026-08-03'), null); // semana 5 adiada
  assert.equal(deloadAdvice([], c, '2026-08-10'), null); // dentro do deload
});

/* ---------- lastTopSummary ---------- */

test('lastTopSummary retorna topo de trabalho da última sessão não-deload', () => {
  const logs = [
    ...sets(4, '2026-07-05', 'remada-curvada', 60, 8),
    ...sets(2, '2026-07-12', 'remada-curvada', 35, 8, { isDeload: true }),
  ];
  const ref = lastTopSummary(logs, 'remada-curvada', 'barra-a', '2026-07-19');
  assert.deepEqual(ref, { weight: 60, reps: 8, date: '2026-07-05' });
});

test('lastTopSummary sem histórico retorna null', () => {
  assert.equal(lastTopSummary([], 'remada-cabo', 'barra-a', '2026-07-19'), null);
});
