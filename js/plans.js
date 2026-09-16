/* Planos são dados imutáveis. O catálogo continua em program.js. */
import { DAYS, WEEKDAYS, EXERCISES } from './program.js';

export const POLICY_VERSION = 'weekly-v1';
export const BASE_PLAN_ID = 'program-initial-v1';
export const clone = (x) => structuredClone(x);
export const validDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x + 'T12:00:00Z')) && new Date(x + 'T12:00:00Z').toISOString().slice(0, 10) === x;
export function initialPlan() {
  const days = clone(DAYS);
  for (const [key, day] of Object.entries(days)) {
    for (const slot of day.slots ?? []) slot.slotId = `${key}:${slot.exerciseId}`;
  }
  return { id: BASE_PLAN_ID, parentId: null, effectiveFrom: '1970-01-01', status: 'applied', days, weekdays: clone(WEEKDAYS), createdAt: 0, policyVersion: POLICY_VERSION, summary: 'Programa inicial', changes: [] };
}

export function planForDate(plans, date) {
  return plans.filter((p) => p.status === 'applied' && p.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt - a.createdAt || b.id.localeCompare(a.id))[0] ?? initialPlan();
}

export function validatePlan(plan) {
  if (!plan || !validDate(plan.effectiveFrom) || !plan.days || !plan.weekdays || typeof plan.id !== 'string') return 'Plano inválido.';
  for (let i = 0; i < 7; i++) if (!plan.days[plan.weekdays[i]]) return 'Calendário incompleto.';
  for (const [key, day] of Object.entries(plan.days)) {
    if (!DAYS[key] || day.kind !== DAYS[key].kind || day.name !== DAYS[key].name) return 'Sessão fora do catálogo.';
    const seen = new Set();
    for (const slot of day.slots ?? []) {
      const base = DAYS[key].slots?.find((s) => `${key}:${s.exerciseId}` === slot.slotId);
      if (!base || seen.has(slot.slotId)) return 'Bloco de exercício inválido ou repetido.';
      seen.add(slot.slotId);
      if (![base.exerciseId, ...(base.alternatives ?? [])].includes(slot.exerciseId) || !EXERCISES[slot.exerciseId]) return 'Exercício fora das alternativas permitidas.';
      if (!Number.isInteger(slot.sets) || slot.sets < 1 || slot.sets > 6 || !Number.isInteger(slot.reps) || slot.reps < 1 || slot.reps > 20) return 'Séries ou repetições fora dos limites.';
      if (slot.rpe != null && (!Number.isFinite(slot.rpe) || slot.rpe < 6 || slot.rpe > 9)) return 'RPE fora dos limites.';
      if (slot.loadFactor != null && (![0.9, 0.95, 1].includes(slot.loadFactor))) return 'Ajuste de carga fora dos limites.';
      if ((slot.role ?? null) !== (base.role ?? null)) return 'A função da prescrição deve ser preservada.';
    }
    if (day.kind === 'lift' && !day.slots?.length) return 'Sessão de força vazia.';
  }
  return null;
}

/* O modelo só devolve ajustes; reconstruímos tudo a partir do plano confiável. */
export function buildProposal(base, input, { id, createdAt = Date.now() }) {
  if (!validDate(input.effectiveFrom) || new Date(input.effectiveFrom + 'T12:00:00Z').getUTCDay() !== 0) throw new Error('A vigência deve começar num domingo.');
  if (!Array.isArray(input.changes) || input.changes.length > 24 || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 3000) throw new Error('Proposta inválida.');
  const plan = { ...clone(base), id, parentId: base.id, status: 'proposed', effectiveFrom: input.effectiveFrom, createdAt, summary: input.summary, policyVersion: POLICY_VERSION, changes: [] };
  for (const day of Object.values(plan.days)) for (const slot of day.slots ?? []) { delete slot.loadFactor; delete slot.loadFrom; delete slot.loadUntil; }
  const seen = new Set();
  for (const change of input.changes) {
    const { dayKey, slotId } = change;
    const slot = plan.days[dayKey]?.slots?.find((s) => s.slotId === slotId);
    if (!slot || seen.has(slotId)) throw new Error('Prescrição inexistente ou duplicada.');
    seen.add(slotId);
    if (typeof change.reason !== 'string' || !change.reason.trim() || change.reason.length > 1500 || !Array.isArray(change.evidenceIds) || !change.evidenceIds.length) throw new Error('Cada ajuste precisa de motivo e evidência.');
    const before = clone(slot);
    for (const field of ['sets', 'reps', 'rpe', 'exerciseId', 'loadFactor']) {
      if (change[field] != null) slot[field] = change[field];
    }
    if (slot.loadFactor != null) {
      slot.loadFrom = input.effectiveFrom;
      const end = new Date(input.effectiveFrom + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 6);
      slot.loadUntil = end.toISOString().slice(0, 10);
    }
    if (Math.abs(slot.sets - before.sets) > 1 || Math.abs(slot.reps - before.reps) > 2 || Math.abs((slot.rpe ?? 0) - (before.rpe ?? 0)) > 1) throw new Error('Ajuste semanal excede os limites de uma etapa.');
    if (slot.exerciseId !== before.exerciseId) {
      const catalog = DAYS[dayKey].slots.find((s) => `${dayKey}:${s.exerciseId}` === slotId);
      slot.alternatives = [catalog.exerciseId, ...(catalog.alternatives ?? [])].filter((x) => x !== slot.exerciseId);
    }
    plan.changes.push({ dayKey, slotId, before, after: clone(slot), reason: change.reason, evidenceIds: change.evidenceIds });
  }
  if (input.weekdays != null) {
    if (!Array.isArray(input.weekdays) || input.weekdays.length !== 7 || input.weekdays.some((x) => !plan.days[x])) throw new Error('Calendário inválido.');
    const lifts = input.weekdays.filter((key) => plan.days[key].kind === 'lift');
    if (new Set(lifts).size !== lifts.length || lifts.length < 1 || lifts.length > 4) throw new Error('Escolha entre 1 e 4 sessões de força diferentes.');
    plan.weekdays = Object.fromEntries(input.weekdays.map((key, i) => [i, key]));
  }
  const error = validatePlan(plan);
  if (error) throw new Error(error);
  return plan;
}

export function effectiveDay(plan, dayKey, snapshot = null) {
  return clone(snapshot ?? plan.days[dayKey] ?? DAYS[dayKey]);
}
