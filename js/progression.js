/*
 * Regras de progressão e utilidades de data/ciclo — funções puras.
 * A v1 usa isto para gerar sugestões na tela de treino; o cálculo
 * automático completo da próxima sessão (v2) pluga aqui.
 */
import {
  EXERCISES,
  CYCLE_WEEKS,
  DELOAD_LOAD_FACTOR,
  FAIL_DELOAD_FACTOR,
  BAR_WEIGHT,
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

export function fmtKg(n) {
  if (n === 0) return 'PC'; // peso corporal
  return `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
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

/* ---------- Rampa de aquecimento ---------- */
/*
 * Séries de aproximação até a carga de trabalho do dia, arredondadas em
 * 2,5kg. Degraus a menos de 5kg do anterior ou colados no alvo caem fora,
 * então alvo baixo (deload incluso) gera rampa curta naturalmente.
 *  - normal:    barra vazia x10 e sobe pelos percentuais
 *  - fromFloor: sem barra vazia — começa em ~50% com anilhas, mínimo 40kg
 * Retorna [{ weight, reps }]; vazio se a carga não justificar rampa.
 */
export const RAMP_STEPS = [
  { pct: 0.5, reps: 5 },
  { pct: 0.7, reps: 3 },
  { pct: 0.85, reps: 2 },
  { pct: 0.93, reps: 1 },
];
export const RAMP_FLOOR_MIN = 40;

export function rampSets(target, { fromFloor = false } = {}) {
  const min = fromFloor ? RAMP_FLOOR_MIN : BAR_WEIGHT;
  if (!target || target <= min) return [];
  const out = fromFloor ? [] : [{ weight: BAR_WEIGHT, reps: 10 }];
  for (const { pct, reps } of RAMP_STEPS) {
    const w = Math.max(round2p5(target * pct), fromFloor ? RAMP_FLOOR_MIN : 0);
    const prev = out[out.length - 1]?.weight ?? 0;
    if ((out.length && w - prev < 5) || w > target - 2.5) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

/* ---------- Ciclo (semanas 1-4 + deload na 5) ---------- */
export function cycleWeek(cycle, dateISO = toISODate()) {
  if (!cycle || !cycle.startDate) return null;
  const days = Math.floor(
    (new Date(`${dateISO}T12:00:00`) - new Date(`${cycle.startDate}T12:00:00`)) / 864e5
  );
  if (days < 0) return null;
  const week = (Math.floor(days / 7) % (CYCLE_WEEKS + 1)) + 1;
  return { week, deload: week === CYCLE_WEEKS + 1 };
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

export function bestE1RM(sets) {
  return Math.max(0, ...sets.map((s) => epley(s.weight, s.reps)));
}

function topWeight(sets) {
  return Math.max(0, ...sets.map((s) => s.weight));
}

/** Sessão "falhou" a prescrição: nenhuma série na carga máxima atingiu as reps prescritas. */
function sessionFailed(session, prescribedReps) {
  if (!prescribedReps) return false;
  const w = topWeight(session.sets);
  const repsAtTop = Math.max(0, ...session.sets.filter((s) => s.weight === w).map((s) => s.reps));
  return repsAtTop < prescribedReps;
}

/* ---------- Resumo: PRs e frequência semanal ---------- */
export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
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
    const w = topWeight(s.sets);
    const rpes = s.sets.filter((x) => x.weight === w && x.rpe != null).map((x) => x.rpe);
    if (!rpes.length) return false;
    return rpes.reduce((a, b) => a + b, 0) / rpes.length >= slot.rpe + 1;
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
 * Retorna { text, weight, status } — weight (ou null) pré-preenche o
 * formulário; status ('ok' | 'atencao' | 'estagnado') dirige o visual do hint.
 * `dayKey` restringe histórico e tendência à mesma prescrição: terra pesado
 * (Barra B) e terra técnico (Barra C) progridem separados, idem agacho A/C.
 */
export function advise(slot, logs, dateISO, deload, dayKey = null) {
  const ex = EXERCISES[slot.exerciseId];
  const past = sessionsFor(logs, slot.exerciseId)
    .map((s) => (dayKey ? { ...s, sets: s.sets.filter((x) => x.dayKey === dayKey) } : s))
    .filter((s) => s.sets.length && s.date < dateISO);

  if (ex.type === 'quality') {
    return { text: 'Progrida em reps e qualidade de execução, não em carga.', weight: null };
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
  const lastTop = topWeight(last.sets);

  if (deload) {
    const w = round2p5(lastTop * DELOAD_LOAD_FACTOR);
    return {
      text: `Deload: ~${fmtKg(w)} (60% de ${fmtKg(lastTop)}), metade das séries, sem RPE alto.`,
      weight: w,
    };
  }

  if (ex.type === 'main') {
    const prev = past.length >= 2 ? past[past.length - 2] : null;
    const failedTwice =
      prev && sessionFailed(last, slot.reps) && sessionFailed(prev, slot.reps);
    if (failedTwice) {
      const w = round2p5(lastTop * FAIL_DELOAD_FACTOR);
      return {
        text: `Falhou 2 semanas seguidas → deload 10%: volte para ~${fmtKg(w)} e reconstrua.`,
        weight: w,
        status: 'estagnado',
      };
    }

    const trend = analyzeTrend(slot, logs, dayKey, dateISO);
    if (trend.status === 'estagnado') {
      const w = round2p5(lastTop * FAIL_DELOAD_FACTOR);
      return {
        text: `Estagnação: ${trendSignals(trend, slot).join(' e ')}. Deload antecipado: volte para ~${fmtKg(w)} (−10%) e reconstrua.`,
        weight: w,
        status: 'estagnado',
      };
    }
    if (trend.status === 'atencao') {
      const [signal] = trendSignals(trend, slot);
      return {
        text: `${signal} — segure ${fmtKg(lastTop)} e busque um RPE mais limpo antes de subir.`,
        weight: lastTop,
        status: 'atencao',
      };
    }

    const w = lastTop + ex.increment;
    return {
      text:
        `Última: ${fmtKg(lastTop)}. Sugestão: ${fmtKg(w)} (+${ex.increment} kg)` +
        (slot.rpe ? ` — só se o RPE se manteve ≤ ${slot.rpe}.` : '.'),
      weight: w,
    };
  }

  // Acessório composto: progressão dupla.
  const [lo, hi] = ex.repRange ?? [slot.reps, slot.reps];
  const setsAtTop = last.sets.filter((s) => s.weight === lastTop);
  const allAtCeiling =
    setsAtTop.length >= (slot.sets ?? 1) && setsAtTop.every((s) => s.reps >= hi);

  if (allAtCeiling) {
    const w = lastTop + 2.5;
    return {
      text: `Fechou ${slot.sets}x${hi} com ${fmtKg(lastTop)} → suba para ${fmtKg(w)} e volte a ~${lo} reps.`,
      weight: w,
    };
  }
  return {
    text: `Mantenha ${fmtKg(lastTop)} e some reps até ${slot.sets}x${hi}; só então suba a carga.`,
    weight: lastTop,
  };
}
