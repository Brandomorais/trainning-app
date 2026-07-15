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
 * `dayKey` restringe a análise de tendência à mesma prescrição.
 */
export function advise(slot, logs, dateISO, deload, dayKey = null) {
  const ex = EXERCISES[slot.exerciseId];
  const past = sessionsFor(logs, slot.exerciseId).filter((s) => s.date < dateISO);

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
