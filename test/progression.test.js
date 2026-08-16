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
  restCountdown,
  sessionsByDay,
  rampSets,
  rampFloorMin,
} from '../js/progression.js';
import { DAYS } from '../js/program.js';

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

/* ---------- restCountdown ---------- */

/* Alvos a partir de um registro em T0: 3-5min → mín em +180s, máx em +300s. */
const T0 = Date.UTC(2026, 7, 10, 20, 0, 0);
const at = (s) => T0 + s * 1000;

test('restCountdown: faixa 3-5min passa por waiting → ready → over', () => {
  const [minAt, maxAt] = [at(180), at(300)];

  const a = restCountdown(minAt, maxAt, '3-5min', at(13));
  assert.equal(a.state, 'waiting');
  assert.match(a.text, /^⏱ 2:47 · volte ~\d{2}:\d{2}$/);

  const b = restCountdown(minAt, maxAt, '3-5min', at(220));
  assert.deepEqual(b, { state: 'ready', text: '⏱ +0:40 · na janela' });

  const c = restCountdown(minAt, maxAt, '3-5min', at(435));
  assert.deepEqual(c, { state: 'over', text: '⏱ +2:15 · passou de 5min' });
});

test('restCountdown: descanso de valor único pula ready (mín = máx)', () => {
  const t = at(60);
  assert.equal(restCountdown(t, t, '60s', at(22)).state, 'waiting');
  assert.deepEqual(restCountdown(t, t, '60s', at(124)), {
    state: 'over',
    text: '⏱ +1:04 · passou de 60s',
  });
});

test('restCountdown: topo do rótulo sai do último trecho da faixa', () => {
  const over = (label, maxS, nowS) =>
    restCountdown(at(0), at(maxS), label, at(nowS)).text;
  assert.match(over('90s-2min', 120, 121), /passou de 2min$/);
  assert.match(over('60-90s', 90, 91), /passou de 90s$/);
  assert.match(over('3-4min', 240, 241), /passou de 4min$/);
});

test('restCountdown: segundos abaixo de 10 vêm com zero à esquerda', () => {
  const t = at(60);
  assert.match(restCountdown(t, t, '60s', at(22)).text, /^⏱ 0:38 /);
  assert.match(restCountdown(t, t, '60s', at(68)).text, /^⏱ \+0:08 /);
});

test('restCountdown: contagem regressiva arredonda para cima (nunca 0:00 esperando)', () => {
  const t = at(60);
  // 200ms antes do alvo ainda é waiting, e deve mostrar 0:01, não 0:00.
  const r = restCountdown(t, t, '60s', t - 200);
  assert.equal(r.state, 'waiting');
  assert.match(r.text, /^⏱ 0:01 /);
});

/* ---------- sessionsByDay ---------- */

test('sessionsByDay separa o mesmo exercício por prescrição', () => {
  const logs = [
    ...sets(4, '2026-07-19', 'agacho', 70, 4, { dayKey: 'barra-a' }),
    ...sets(4, '2026-07-24', 'agacho', 50, 6, { dayKey: 'barra-c' }),
    ...sets(4, '2026-07-26', 'agacho', 75, 4, { dayKey: 'barra-a' }),
  ];
  const g = sessionsByDay(logs, 'agacho');
  assert.deepEqual(g.map((x) => x.dayKey), ['barra-a', 'barra-c']);
  assert.equal(g[0].sessions.length, 2);
  assert.equal(g[1].sessions.length, 1);
  // o slot correto vem junto, para rotular a série com a prescrição
  assert.equal(g[0].slot.reps, 4);
  assert.equal(g[1].slot.reps, 6);
});

test('sessionsByDay: ordem segue DAYS, não o volume de dados', () => {
  // barra-c tem muito mais sessões, mas barra-a vem primeiro (cor estável).
  const logs = [
    ...sets(4, '2026-07-17', 'agacho', 50, 6, { dayKey: 'barra-c' }),
    ...sets(4, '2026-07-24', 'agacho', 55, 6, { dayKey: 'barra-c' }),
    ...sets(4, '2026-08-01', 'agacho', 60, 6, { dayKey: 'barra-c' }),
    ...sets(4, '2026-07-26', 'agacho', 70, 4, { dayKey: 'barra-a' }),
  ];
  assert.deepEqual(sessionsByDay(logs, 'agacho').map((x) => x.dayKey), ['barra-a', 'barra-c']);
});

test('sessionsByDay: exercício de um dia só retorna um grupo (sem legenda)', () => {
  const logs = sets(4, '2026-07-22', 'puxada', 50, 10, { dayKey: 'barra-b' });
  const g = sessionsByDay(logs, 'puxada');
  assert.equal(g.length, 1);
  assert.equal(g[0].dayKey, 'barra-b');
});

test('sessionsByDay: registro em dia sem slot vira grupo próprio, no fim', () => {
  // dead bug logado avulso na barra-a (onde não há slot dele) não pode sujar
  // a linha da barra-d, que é a prescrição de verdade.
  const logs = [
    ...sets(3, '2026-08-03', 'dead-bug', 0, 10, { dayKey: 'barra-d' }),
    ...sets(2, '2026-07-28', 'dead-bug', 0, 10, { dayKey: 'barra-a' }),
  ];
  const g = sessionsByDay(logs, 'dead-bug');
  assert.deepEqual(g.map((x) => x.dayKey), ['barra-a', 'barra-d']);
  assert.equal(g[0].slot, null); // barra-a não tem slot de dead bug
  assert.ok(g[1].slot); // barra-d tem
});

test('sessionsByDay: dayKey desconhecido não quebra e vai para o fim', () => {
  const logs = [
    ...sets(4, '2026-07-19', 'agacho', 70, 4, { dayKey: 'barra-a' }),
    ...sets(4, '2026-07-20', 'agacho', 70, 4, { dayKey: 'dia-que-nao-existe' }),
  ];
  const g = sessionsByDay(logs, 'agacho');
  assert.deepEqual(g.map((x) => x.dayKey), ['barra-a', 'dia-que-nao-existe']);
  assert.equal(g[1].name, 'dia-que-nao-existe');
  assert.equal(g[1].slot, null);
});

/* ---------- Rampa de aquecimento ---------- */

test('rampSets: grade grossa não gera peso quebrado', () => {
  // A grade da rampa (5kg) é mais grossa que a da carga de trabalho (2,5kg):
  // nenhum degrau pode cair fora do múltiplo de 5.
  for (const alvo of [65, 72.5, 75, 80, 95, 102.5]) {
    for (const s of rampSets(alvo)) {
      assert.equal(s.weight % 5, 0, `degrau quebrado ${s.weight} no alvo ${alvo}`);
    }
  }
});

test('rampSets: agacho de 80kg sai em 4 séries, 3 trocas de anilha', () => {
  assert.deepEqual(rampSets(80), [
    { weight: 20, reps: 10 }, // barra vazia
    { weight: 40, reps: 5 },
    { weight: 55, reps: 3 },
    { weight: 70, reps: 2 },
  ]);
});

test('rampSets: alvo leve de deload encurta a rampa sozinho', () => {
  // 47,5kg = 60% de 80. Não faz sentido montar a barra 5 vezes para 2x4.
  assert.deepEqual(rampSets(47.5), [
    { weight: 20, reps: 10 },
    { weight: 35, reps: 3 },
  ]);
});

test('rampSets: fromFloor não usa barra vazia e respeita o piso', () => {
  const r = rampSets(95, { fromFloor: true });
  assert.ok(r.every((s) => s.weight >= rampFloorMin('kg')));
  assert.equal(r[0].weight, 50);
  assert.ok(r[r.length - 1].weight < 95);
});

test('rampSets: alvo igual ou abaixo da barra não gera rampa', () => {
  assert.deepEqual(rampSets(20), []);
  assert.deepEqual(rampSets(0), []);
  assert.deepEqual(rampSets(null), []);
});

test('rampSets: em libras a grade é de 10lb', () => {
  const r = rampSets(185, { unit: 'lb' });
  assert.equal(r[0].weight, 45); // barra vazia: peso do equipamento, não passa pela grade
  for (const s of r.slice(1)) {
    assert.equal(s.weight % 10, 0, `degrau quebrado ${s.weight}`);
  }
});

test('rampSets: degraus sempre crescem e param antes do alvo', () => {
  for (const alvo of [50, 65, 80, 95, 120]) {
    const r = rampSets(alvo);
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i].weight > r[i - 1].weight, `degrau não cresceu no alvo ${alvo}`);
    }
    assert.ok(r.every((s) => s.weight < alvo), `degrau alcançou o alvo ${alvo}`);
  }
});

test('deload: Barra D vira aeróbico, Barras A/B/C ficam intactas', () => {
  // O dia de acessório (maior volume da semana) sai; o SBD pesado continua
  // no formato normal de deload, que é onde a fadiga foi gerada.
  assert.equal(DAYS['barra-d'].deloadReplaceWith, 'aerobico');
  assert.ok(DAYS['aerobico'], 'o dia de destino da troca precisa existir');
  assert.equal(DAYS[DAYS['barra-d'].deloadReplaceWith].kind, 'cardio');
  for (const k of ['barra-a', 'barra-b', 'barra-c']) {
    assert.ok(!DAYS[k].deloadReplaceWith, `${k} não deve ser trocada no deload`);
  }
});
