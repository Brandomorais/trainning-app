/*
 * Regras de progressão e utilidades de data/ciclo — funções puras.
 * A v1 usa isto para gerar sugestões na tela de treino; o cálculo
 * automático completo da próxima sessão (v2) pluga aqui.
 */
import {
  EXERCISES,
  DAYS,
  CYCLE_WEEKS,
  DELOAD_MIN_WEEK,
  DELOAD_LOAD_FACTOR,
  FAIL_DELOAD_FACTOR,
  BAR_WEIGHT,
  BAR_WEIGHT_LB,
} from './program.js';

/* ---------- e1RM ---------- */
export function epley(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function round2p5(w) {
  return Math.round(w / 2.5) * 2.5;
}

/* ---------- Datas (sempre no fuso local) ---------- */
export function toISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lastSundayISO(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return toISODate(x);
}

export function formatDateLong(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateShort(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ---------- Unidades (kg canônico; lb só entrada/exibição) ---------- */
/*
 * Todo peso é GRAVADO em kg. Exercícios de máquina/polia marcados como 'lb'
 * (settings.units) convertem na borda: digitação lb → kg ao salvar, kg →
 * lb ao exibir. Trocar a unidade depois não corrompe nada — só muda a lente.
 */
export const LB_PER_KG = 2.20462262;
export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;

/** kg → número exibível na unidade (lb arredondada a 0,5; kg a 0,01). */
export function displayWeight(kg, unit = 'kg') {
  return unit === 'lb' ? Math.round(kgToLb(kg) * 2) / 2 : Math.round(kg * 100) / 100;
}

export function fmtWeight(kg, unit = 'kg') {
  if (kg === 0) return 'PC'; // peso corporal
  return `${displayWeight(kg, unit).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`;
}

/** Arredonda uma sugestão (em kg) para a grade da unidade: 2,5kg ou 5lb. */
export function roundToUnit(kg, unit = 'kg') {
  return unit === 'lb' ? lbToKg(Math.round(kgToLb(kg) / 5) * 5) : round2p5(kg);
}

/* ---------- Tempo e pace (aeróbico) ---------- */
/*
 * Aceita "42:30" (min:seg), "1:02:10" (h:min:seg) e "42" ou "42,5" (minutos).
 * Retorna segundos inteiros, ou null se não der para interpretar.
 */
export function parseTime(str) {
  const s = String(str ?? '').trim().replace(',', '.');
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  let sec;
  if (parts.length === 1) sec = parseFloat(parts[0]) * 60;
  else if (parts.length === 2) sec = +parts[0] * 60 + +parts[1];
  else sec = +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
  if (parts.length >= 2 && +parts[parts.length - 1] >= 60) return null;
  if (parts.length === 3 && +parts[1] >= 60) return null;
  sec = Math.round(sec);
  return sec > 0 ? sec : null;
}

/** Segundos → "42:30" ou "1:02:10". */
export function formatTime(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
}

/** Pace em segundos por `paceRef` metros (100 → /100m, 1000 → /km). */
export function paceFor(meters, seconds, paceRef) {
  if (!meters || !seconds) return null;
  return (seconds / meters) * paceRef;
}

/* ---------- Descanso prescrito ---------- */
/*
 * Faixa de descanso do slot → segundos: '60s', '90s', '3-5min', '90s-2min',
 * '60-90s'. Um lado sem sufixo herda a unidade do outro. Retorna
 * { min, max } ou null se não der para interpretar.
 */
export function parseRestRange(str) {
  const parts = String(str ?? '').trim().split('-');
  if (!parts.length || parts.length > 2) return null;
  const raw = parts.map((p) => {
    const m = /^(\d+(?:[.,]\d+)?)\s*(s|min)?$/.exec(p.trim());
    return m ? { n: parseFloat(m[1].replace(',', '.')), unit: m[2] ?? null } : null;
  });
  if (raw.some((r) => !r)) return null;
  const fallback = raw.find((r) => r.unit)?.unit;
  if (!fallback) return null;
  const secs = raw.map((r) => Math.round(r.n * ((r.unit ?? fallback) === 'min' ? 60 : 1)));
  const [min, max] = secs.length === 2 ? secs : [secs[0], secs[0]];
  return min > 0 && max >= min ? { min, max } : null;
}

/*
 * Estado do cronômetro de descanso, a partir dos instantes-alvo (epoch ms)
 * derivados do registro da última série. Puro: `now` entra por parâmetro.
 *  - waiting: ainda descansando, conta para trás até o mínimo
 *  - ready:   dentro da janela prescrita (só existe se max > min)
 *  - over:    passou do máximo
 * `restLabel` é o `rest` do slot ('3-5min'); o topo sai do último trecho.
 */
export function restCountdown(minAt, maxAt, restLabel, now = Date.now()) {
  const backAt = new Date(minAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  // Ceil na contagem regressiva (não mostra 0:00 enquanto ainda falta tempo)
  // e floor no decorrido (só marca +0:01 depois de um segundo cheio).
  if (now < minAt) {
    return { state: 'waiting', text: `⏱ ${formatTime(Math.ceil((minAt - now) / 1000))} · volte ~${backAt}` };
  }
  if (now < maxAt) {
    return { state: 'ready', text: `⏱ +${formatTime(Math.floor((now - minAt) / 1000))} · na janela` };
  }
  const top = String(restLabel ?? '').trim().split('-').pop();
  return { state: 'over', text: `⏱ +${formatTime(Math.floor((now - maxAt) / 1000))} · passou de ${top}` };
}

/* ---------- Rampa de aquecimento ---------- */
/*
 * Séries de aproximação até a carga de trabalho do dia, TUDO na unidade
 * ativa (calculadora não grava nada): grade de 2,5kg/barra 20kg, ou grade
 * de 5lb/barra 45lb em academia de libras. Degraus a menos de 2 grades do
 * anterior ou colados no alvo caem fora, então alvo baixo (deload incluso)
 * gera rampa curta naturalmente.
 *  - normal:    barra vazia x10 e sobe pelos percentuais
 *  - fromFloor: sem barra vazia — começa em ~50% com anilhas, mínimo
 *               40kg/90lb (altura da barra no chão)
 * Retorna [{ weight, reps }]; vazio se a carga não justificar rampa.
 */
export const RAMP_STEPS = [
  { pct: 0.5, reps: 5 },
  { pct: 0.7, reps: 3 },
  { pct: 0.85, reps: 2 },
  { pct: 0.93, reps: 1 },
];
export const rampFloorMin = (unit = 'kg') => (unit === 'lb' ? 90 : 40);

/*
 * Grade de arredondamento da RAMPA — deliberadamente mais grossa que a da
 * carga de trabalho (`roundToUnit`). Precisão de 2,5kg/5lb num aquecimento não
 * compra nada e só produz peso quebrado (32,5 · 52,5 · 67,5) e uma troca de
 * anilha a mais por degrau. A grade também alarga a folga mínima entre
 * degraus, o que encurta a rampa sozinho: o degrau de 93% colapsa dentro da
 * série de trabalho, e alvo leve (deload) vira rampa de 1-2 aproximações.
 */
export const rampGrid = (unit = 'kg') => (unit === 'lb' ? 10 : 5);

export function rampSets(target, { fromFloor = false, unit = 'kg' } = {}) {
  const grid = rampGrid(unit);
  const bar = unit === 'lb' ? BAR_WEIGHT_LB : BAR_WEIGHT;
  const floorMin = rampFloorMin(unit);
  const min = fromFloor ? floorMin : bar;
  if (!target || target <= min) return [];
  const out = fromFloor ? [] : [{ weight: bar, reps: 10 }];
  for (const { pct, reps } of RAMP_STEPS) {
    const w = Math.max(Math.round((target * pct) / grid) * grid, fromFloor ? floorMin : 0);
    const prev = out[out.length - 1]?.weight ?? 0;
    if ((out.length && w - prev < 2 * grid) || w > target - grid) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

/* ---------- Ciclo (semanas 1-4 + deload na 5; híbrido via deloadStart) ---------- */
const dayDiff = (aISO, bISO) =>
  Math.floor((new Date(`${aISO}T12:00:00`) - new Date(`${bISO}T12:00:00`)) / 864e5);

/*
 * Sem `cycle.deloadStart`: comportamento calendárico intacto (módulo de 5
 * semanas, deload na 5ª, recomeço automático). `deloadStart` é a intervenção
 * reativa (antecipar/adiar) e é interpretado lazy, sem writes:
 *  - dentro de [deloadStart, +7d) → semana de deload;
 *  - depois → o ciclo recomeça de deloadStart+7 e o módulo default volta;
 *  - antes (deload adiado) → conta linear de startDate; a 5ª semana vira
 *    treino normal com `delayed: true` (badge "deload adiado").
 */
export function cycleWeek(cycle, dateISO = toISODate()) {
  if (!cycle || !cycle.startDate) return null;
  if (cycle.deloadStart) {
    const d = dayDiff(dateISO, cycle.deloadStart);
    if (d >= 0 && d < 7) return { week: CYCLE_WEEKS + 1, deload: true };
    if (d >= 7) return cycleWeek({ startDate: addDaysISO(cycle.deloadStart, 7) }, dateISO);
  }
  const days = dayDiff(dateISO, cycle.startDate);
  if (days < 0) return null;
  if (cycle.deloadStart) {
    // Deload marcado para o futuro: conta linear, sem o módulo (que faria a
    // 5ª semana virar deload por conta própria).
    const week = Math.floor(days / 7) + 1;
    return { week, deload: false, delayed: week > CYCLE_WEEKS };
  }
  const week = (Math.floor(days / 7) % (CYCLE_WEEKS + 1)) + 1;
  return { week, deload: week === CYCLE_WEEKS + 1 };
}

/*
 * Ajuste reativo da janela de deload (modelo híbrido — docs §5):
 *  - { type: 'antecipar' }: semana ≥ DELOAD_MIN_WEEK fora do deload, sem
 *    intervenção pendente, e fadiga nos básicos pesados (≥2 com sinal no
 *    analyzeTrend, ≥1 'estagnado');
 *  - { type: 'adiar' }: na 5ª semana default, básicos todos 'ok', nenhuma
 *    série de deload gravada na semana e sem intervenção pendente (teto
 *    duro: uma vez adiado, sem segunda oferta — deload na 6ª).
 * Retorna { type, week, signals, deloadStart } (deloadStart = data a gravar
 * via setCycle se o usuário aceitar) ou null.
 */
export function deloadAdvice(logs, cycle, dateISO = toISODate()) {
  const wk = cycleWeek(cycle, dateISO);
  if (!wk) return null;
  // Intervenção pendente (deload antecipado em curso ou adiado à espera):
  // nada a oferecer até a janela passar.
  if (cycle.deloadStart && dayDiff(dateISO, addDaysISO(cycle.deloadStart, 7)) < 0) return null;

  const trends = [];
  for (const [dayKey, day] of Object.entries(DAYS)) {
    for (const slot of day.slots ?? []) {
      if (!slot.ramp) continue; // os 3 básicos pesados (agacho A, terra B, supino C)
      const trend = analyzeTrend(slot, logs, dayKey, dateISO);
      trends.push({ name: EXERCISES[slot.exerciseId].name, trend });
    }
  }
  const flagged = trends.filter((t) => t.trend.status !== 'ok');
  const fatigued = flagged.length >= 2 && flagged.some((t) => t.trend.status === 'estagnado');

  // Início efetivo do ciclo corrente (pós-deload consumido, se houver).
  const effStart =
    cycle.deloadStart && dayDiff(dateISO, addDaysISO(cycle.deloadStart, 7)) >= 0
      ? addDaysISO(cycle.deloadStart, 7)
      : cycle.startDate;
  const weekStart = addDaysISO(effStart, Math.floor(dayDiff(dateISO, effStart) / 7) * 7);

  if (wk.deload) {
    const deloadLogged = logs.some(
      (l) => l.isDeload && l.date >= weekStart && l.date < addDaysISO(weekStart, 7)
    );
    if (!flagged.length && !deloadLogged) {
      return { type: 'adiar', week: wk.week, signals: [], deloadStart: addDaysISO(weekStart, 7) };
    }
    return null;
  }

  if (wk.week >= DELOAD_MIN_WEEK && fatigued) {
    const signals = flagged.map(
      (t) => `${t.name} ${t.trend.status === 'estagnado' ? 'estagnado' : 'em atenção'}`
    );
    return { type: 'antecipar', week: wk.week, signals, deloadStart: dateISO };
  }
  return null;
}

/* ---------- Histórico por exercício ---------- */
/** Agrupa séries de um exercício por data. Retorna [{ date, sets: [...] }] em ordem crescente. */
export function sessionsFor(logs, exerciseId) {
  const byDate = new Map();
  for (const l of logs) {
    if (l.exerciseId !== exerciseId) continue;
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date).push(l);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, sets]) => ({
      date,
      sets: sets.sort((a, b) => a.createdAt - b.createdAt),
    }));
}

/*
 * O mesmo exercício vive em prescrições diferentes (agacho pesado na Barra A e
 * volume na Barra C, terra pesado na B e técnico na C). Misturá-las numa série
 * só transforma duas progressões limpas num serrote — este agrupamento é o que
 * mantém cada prescrição na sua própria linha.
 *
 * Retorna [{ dayKey, name, slot, sessions }] na ordem de declaração de DAYS —
 * ordem estável de propósito: a cor da série segue a entidade, nunca o ranking
 * de quantidade de dados. `dayKey` sem slot correspondente (registro avulso, ou
 * dia que saiu do programa) vira grupo próprio em vez de sujar outra linha.
 */
export function sessionsByDay(logs, exerciseId) {
  const order = Object.keys(DAYS);
  const seen = [...new Set(logs.filter((l) => l.exerciseId === exerciseId).map((l) => l.dayKey))];
  seen.sort((a, b) => {
    const [ia, ib] = [order.indexOf(a), order.indexOf(b)];
    if (ia !== ib) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    return a < b ? -1 : 1;
  });
  return seen.map((dayKey) => ({
    dayKey,
    name: DAYS[dayKey]?.name ?? dayKey,
    slot: (DAYS[dayKey]?.slots ?? []).find((s) => s.exerciseId === exerciseId) ?? null,
    sessions: sessionsFor(
      logs.filter((l) => l.dayKey === dayKey),
      exerciseId
    ),
  }));
}

export function bestE1RM(sets) {
  return Math.max(0, ...sets.map((s) => epley(s.weight, s.reps)));
}

function topWeight(sets) {
  return Math.max(0, ...sets.map((s) => s.weight));
}

/*
 * Peso de TRABALHO da sessão: o mais pesado com ≥2 séries. Um single acima
 * das séries de trabalho (feeler/tentativa de PR) não vira base de falha,
 * de incremento nem de RPE. Sessões só de singles (ex. terra técnico 2x…
 * registrado em dias separados) caem no mais pesado mesmo.
 */
export function workTopWeight(sets) {
  const count = new Map();
  for (const s of sets) count.set(s.weight, (count.get(s.weight) ?? 0) + 1);
  const repeated = [...count.entries()].filter(([, n]) => n >= 2).map(([w]) => w);
  return repeated.length ? Math.max(...repeated) : topWeight(sets);
}

/** RPE médio nas séries da carga de trabalho da sessão (null se nada marcado). */
function workTopRpe(session) {
  const w = workTopWeight(session.sets);
  const rpes = session.sets.filter((x) => x.weight === w && x.rpe != null).map((x) => x.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

/** Sessão "falhou" a prescrição: nenhuma série na carga de trabalho atingiu as reps prescritas. */
function sessionFailed(session, prescribedReps) {
  if (!prescribedReps) return false;
  const w = workTopWeight(session.sets);
  const repsAtTop = Math.max(0, ...session.sets.filter((s) => s.weight === w).map((s) => s.reps));
  return repsAtTop < prescribedReps;
}

/* ---------- Resumo: PRs e frequência semanal ---------- */
export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/*
 * Última sessão não-deload de um exercício num dia do programa:
 * { weight, reps, date } ou null. Usado como linha de referência quando o
 * usuário troca para uma alternativa sem histórico próprio.
 */
export function lastTopSummary(logs, exerciseId, dayKey, dateISO = toISODate()) {
  const past = sessionsFor(logs, exerciseId)
    .map((s) => (dayKey ? { ...s, sets: s.sets.filter((x) => x.dayKey === dayKey) } : s))
    .filter((s) => s.sets.length && s.date <= dateISO && !s.sets.some((x) => x.isDeload));
  const last = past[past.length - 1];
  if (!last) return null;
  const w = workTopWeight(last.sets);
  const reps = Math.max(0, ...last.sets.filter((x) => x.weight === w).map((x) => x.reps));
  return { weight: w, reps, date: last.date };
}

/** Melhor e1RM já registrado do exercício: { e1rm, weight, reps, date } ou null. */
export function bestPR(logs, exerciseId) {
  let best = null;
  for (const l of logs) {
    if (l.exerciseId !== exerciseId || !l.weight || !l.reps) continue;
    const e = epley(l.weight, l.reps);
    if (!best || e > best.e1rm) best = { e1rm: e, weight: l.weight, reps: l.reps, date: l.date };
  }
  return best;
}

/*
 * Treinos de força por semana (dom-sáb), das últimas `weeks` semanas até a
 * atual. Um treino = par (data, dia do programa) distinto. Semanas vazias
 * anteriores ao primeiro registro são cortadas.
 */
export function weeklyLiftCounts(logs, weeks = 12, todayISO = toISODate()) {
  const sunday0 = lastSundayISO(new Date(`${todayISO}T12:00:00`));
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDaysISO(sunday0, -7 * i);
    const end = addDaysISO(start, 6);
    const wlogs = logs.filter((l) => l.date >= start && l.date <= end);
    out.push({
      label: formatDateShort(start),
      value: new Set(wlogs.map((l) => `${l.date}|${l.dayKey}`)).size,
      deload: wlogs.some((l) => l.isDeload),
      start,
    });
  }
  while (out.length > 1 && out[0].value === 0) out.shift();
  return out;
}

/* ---------- Detecção de estagnação ---------- */
/*
 * Analisa as últimas sessões NÃO-deload de um exercício restritas a um
 * dia do programa (mesma prescrição: agacho pesado ≠ agacho volume).
 * `dateISO` limita a janela a sessões anteriores à data (null = todas).
 *
 * Sinais:
 *  - e1rmStalled: melhor e1RM da sessão não superou o de 3 sessões atrás
 *  - rpeHigh: RPE médio nas séries da carga máxima ≥ alvo + 1 nas 2 últimas
 *
 * Status: 1 sinal → 'atencao'; 2 sinais, ou 1 sinal persistindo por
 * 4 sessões → 'estagnado'. Menos de 3 sessões → 'ok' (sem alarme falso).
 */
export function analyzeTrend(slot, logs, dayKey, dateISO = null) {
  const sessions = sessionsFor(logs, slot.exerciseId)
    .filter((s) => !dateISO || s.date < dateISO)
    .map((s) => ({ ...s, sets: dayKey ? s.sets.filter((x) => x.dayKey === dayKey) : s.sets }))
    .filter((s) => s.sets.length && !s.sets.some((x) => x.isDeload));

  const n = sessions.length;
  if (n < 3) {
    return { status: 'ok', sessions: n, e1rmStalled: false, rpeHigh: false, insufficient: true };
  }

  const e1rms = sessions.map((s) => bestE1RM(s.sets));
  const stalled3 = e1rms[n - 1] <= e1rms[n - 3];
  const stalled4 = n >= 4 && e1rms[n - 1] <= e1rms[n - 4];

  const overTarget = (s) => {
    if (!slot.rpe) return false;
    const rpe = workTopRpe(s); // carga de trabalho: feeler/PR single não conta
    return rpe != null && rpe >= slot.rpe + 1;
  };
  const rpeHigh2 = overTarget(sessions[n - 1]) && overTarget(sessions[n - 2]);
  const rpeHigh3 = rpeHigh2 && overTarget(sessions[n - 3]);

  let status = 'ok';
  if (stalled3 || rpeHigh2) status = 'atencao';
  if ((stalled3 && rpeHigh2) || stalled4 || rpeHigh3) status = 'estagnado';

  return { status, sessions: n, e1rmStalled: stalled3, rpeHigh: rpeHigh2, insufficient: false };
}

/** Descrição humana dos sinais de um trend (para hint e histórico). */
export function trendSignals(trend, slot) {
  const out = [];
  if (trend.e1rmStalled) out.push('e1RM sem subir há 3+ sessões');
  if (trend.rpeHigh) out.push(`RPE saindo acima do alvo ${slot.rpe} nas últimas sessões`);
  return out;
}

/*
 * Sugestão para um slot do treino, olhando o histórico ANTES de `dateISO`.
 * Retorna { text, weight, status } — weight (kg, ou null) pré-preenche o
 * formulário; status ('ok' | 'atencao' | 'estagnado') dirige o visual do hint.
 * `dayKey` restringe histórico e tendência à mesma prescrição: terra pesado
 * (Barra B) e terra técnico (Barra C) progridem separados, idem agacho A/C.
 * `unit` só muda textos e a grade de arredondamento — a conta é sempre em kg.
 */
export function advise(slot, logs, dateISO, deload, dayKey = null, unit = 'kg') {
  const ex = EXERCISES[slot.exerciseId];
  // Sessões de deload ficam FORA do histórico: a 1ª sessão pós-deload deve
  // partir do topo de trabalho real, não dos 60% da semana leve.
  const past = sessionsFor(logs, slot.exerciseId)
    .map((s) => (dayKey ? { ...s, sets: s.sets.filter((x) => x.dayKey === dayKey) } : s))
    .filter((s) => s.sets.length && s.date < dateISO && !s.sets.some((x) => x.isDeload));

  if (ex.type === 'quality') {
    return {
      text: ex.timed
        ? 'Progrida em tempo sob tensão e qualidade de execução, não em carga.'
        : 'Progrida em reps e qualidade de execução, não em carga.',
      weight: null,
    };
  }

  if (!past.length) {
    return {
      text: slot.rpe
        ? `Primeira sessão registrada — encontre a carga que fique em RPE ${slot.rpe}.`
        : 'Primeira sessão registrada — comece conservador e anote a carga.',
      weight: null,
    };
  }

  const last = past[past.length - 1];
  const lastTop = workTopWeight(last.sets);

  if (deload) {
    const w = roundToUnit(lastTop * DELOAD_LOAD_FACTOR, unit);
    return {
      text: `Deload: ~${fmtWeight(w, unit)} (60% de ${fmtWeight(lastTop, unit)}), metade das séries, sem RPE alto.`,
      weight: w,
    };
  }

  if (ex.type === 'main') {
    const prev = past.length >= 2 ? past[past.length - 2] : null;
    const failedTwice =
      prev && sessionFailed(last, slot.reps) && sessionFailed(prev, slot.reps);
    if (failedTwice) {
      const w = roundToUnit(lastTop * FAIL_DELOAD_FACTOR, unit);
      return {
        text: `Falhou 2 semanas seguidas → deload 10%: volte para ~${fmtWeight(w, unit)} e reconstrua.`,
        weight: w,
        status: 'estagnado',
      };
    }

    const trend = analyzeTrend(slot, logs, dayKey, dateISO);
    if (trend.status === 'estagnado') {
      const w = roundToUnit(lastTop * FAIL_DELOAD_FACTOR, unit);
      return {
        text: `Estagnação: ${trendSignals(trend, slot).join(' e ')}. Deload antecipado: volte para ~${fmtWeight(w, unit)} (−10%) e reconstrua.`,
        weight: w,
        status: 'estagnado',
      };
    }
    if (trend.status === 'atencao') {
      const [signal] = trendSignals(trend, slot);
      return {
        text: `${signal} — segure ${fmtWeight(lastTop, unit)} e busque um RPE mais limpo antes de subir.`,
        weight: lastTop,
        status: 'atencao',
      };
    }

    // RPE médio nas séries da carga de trabalho modula o salto (regra de
    // autorregulação ~2%/0,5 ponto — ver docs §5): ≥ alvo+2 recua um degrau;
    // ≥ alvo+1 segura; ≤ alvo−2 nas DUAS últimas sessões dobra o incremento
    // (fácil isolado é ruído). Sem RPE marcado, incremento padrão com ressalva.
    const lastRpe = workTopRpe(last);
    const prevRpe = prev ? workTopRpe(prev) : null;
    const fmtRpe = (r) => `@${r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;

    if (slot.rpe && lastRpe != null && lastRpe >= slot.rpe + 2) {
      const w = roundToUnit(Math.max(0, lastTop - (unit === 'lb' ? lbToKg(5) : 2.5)), unit);
      return {
        text: `Última: ${fmtWeight(lastTop, unit)} ${fmtRpe(lastRpe)}, muito acima do alvo @${slot.rpe} — recue um degrau: ${fmtWeight(w, unit)}.`,
        weight: w,
        status: 'atencao',
      };
    }
    if (slot.rpe && lastRpe != null && lastRpe >= slot.rpe + 1) {
      return {
        text: `Última: ${fmtWeight(lastTop, unit)} ${fmtRpe(lastRpe)}, acima do alvo @${slot.rpe} — segure ${fmtWeight(lastTop, unit)} e busque um RPE mais limpo antes de subir.`,
        weight: lastTop,
        status: 'atencao',
      };
    }

    // Incremento na grade da unidade: 5/2,5kg viram 10/5lb em academia de libras.
    const easy =
      slot.rpe &&
      lastRpe != null && lastRpe <= slot.rpe - 2 &&
      prevRpe != null && prevRpe <= slot.rpe - 2;
    const mult = easy ? 2 : 1;
    const incLb = (ex.increment === 2.5 ? 5 : 10) * mult;
    const incKg = ex.increment * mult;
    const w = lastTop + (unit === 'lb' ? lbToKg(incLb) : incKg);
    const incTxt = unit === 'lb' ? `${incLb} lb` : `${incKg} kg`;
    if (easy) {
      return {
        text: `Duas sessões bem abaixo do alvo @${slot.rpe} (última: ${fmtWeight(lastTop, unit)} ${fmtRpe(lastRpe)}) — dobro do incremento: ${fmtWeight(w, unit)} (+${incTxt}).`,
        weight: w,
      };
    }
    return {
      text:
        `Última: ${fmtWeight(lastTop, unit)}${lastRpe != null ? ` ${fmtRpe(lastRpe)}` : ''}. Sugestão: ${fmtWeight(w, unit)} (+${incTxt})` +
        (slot.rpe && lastRpe == null ? ` — só se o RPE se manteve ≤ ${slot.rpe}.` : '.'),
      weight: w,
    };
  }

  // Acessório composto: progressão dupla (incremento na grade da unidade).
  const [lo, hi] = ex.repRange ?? [slot.reps, slot.reps];
  const setsAtTop = last.sets.filter((s) => s.weight === lastTop);
  const allAtCeiling =
    setsAtTop.length >= (slot.sets ?? 1) && setsAtTop.every((s) => s.reps >= hi);

  if (allAtCeiling) {
    const w = lastTop + (unit === 'lb' ? lbToKg(5) : 2.5);
    return {
      text: `Fechou ${slot.sets}x${hi} com ${fmtWeight(lastTop, unit)} → suba para ${fmtWeight(w, unit)} e volte a ~${lo} reps.`,
      weight: w,
    };
  }

  // Travas de estagnação do acessório (prática comum de progressão dupla —
  // recuo de 5-10% e reconstrução; sem RCT direto, ver docs §5):
  // (a) melhor série no topo abaixo do piso `lo` por 2 sessões seguidas na
  //     mesma carga → recue 10% e reconstrua por reps;
  const prevAcc = past.length >= 2 ? past[past.length - 2] : null;
  const bestRepsAtTop = (session) => {
    const w = workTopWeight(session.sets);
    return Math.max(0, ...session.sets.filter((s) => s.weight === w).map((s) => s.reps));
  };
  if (
    prevAcc &&
    workTopWeight(prevAcc.sets) === lastTop &&
    bestRepsAtTop(last) < lo &&
    bestRepsAtTop(prevAcc) < lo
  ) {
    const w = roundToUnit(lastTop * FAIL_DELOAD_FACTOR, unit);
    return {
      text: `Reps abaixo do piso ${lo} há 2 sessões com ${fmtWeight(lastTop, unit)} → recue ~10%: ${fmtWeight(w, unit)} e reconstrua.`,
      weight: w,
      status: 'estagnado',
    };
  }

  // (b) 4+ sessões na mesma carga sem o total de reps no topo progredir →
  //     aviso para recuar 5-10% ou subir o degrau da escada (docs §8.0).
  const sameW = past.filter((s) => workTopWeight(s.sets) === lastTop);
  if (sameW.length >= 4) {
    const topRepsTotal = (session) => {
      const w = workTopWeight(session.sets);
      return session.sets.filter((s) => s.weight === w).reduce((a, s) => a + s.reps, 0);
    };
    const seq = sameW.slice(-4).map(topRepsTotal);
    if (seq[3] <= seq[0]) {
      return {
        text: `4 sessões em ${fmtWeight(lastTop, unit)} sem somar reps — recue 5-10% e reconstrua, ou suba o degrau da variação.`,
        weight: lastTop,
        status: 'atencao',
      };
    }
  }

  return {
    text: `Mantenha ${fmtWeight(lastTop, unit)} e some reps até ${slot.sets}x${hi}; só então suba a carga.`,
    weight: lastTop,
  };
}
