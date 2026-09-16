import { validDate, validatePlan } from './plans.js';
import { DAYS, EXERCISES, CARDIO_MODALITIES } from './program.js';

const text = (s, max) => typeof s === 'string' && s.length <= max;
const finite = (x, min, max) => Number.isFinite(x) && x >= min && x <= max;
export function recordError(kind, value) {
  if (!value || !text(value.id, 200) || !/^[a-zA-Z0-9:_\-.]+$/.test(value.id)) return 'Identificador inválido.';
  if (['logs','cardio','exerciseNotes','sessions','feedback'].includes(kind) && !validDate(value.date)) return 'Data inválida.';
  if (['logs','exerciseNotes','sessions'].includes(kind) && !DAYS[value.dayKey]) return 'Sessão desconhecida.';
  if (kind === 'logs') {
    if (!EXERCISES[value.exerciseId] || !finite(value.weight, 0, 2000) || !Number.isInteger(value.reps) || value.reps < 1 || value.reps > 10000 || value.rpe != null && !finite(value.rpe, 1, 10)) return 'Série inválida.';
  }
  if (kind === 'cardio' && (!CARDIO_MODALITIES[value.modality] || !finite(value.meters,1,1000000) || !finite(value.seconds,1,604800))) return 'Registro aeróbico inválido.';
  if (kind === 'exerciseNotes' && (!EXERCISES[value.exerciseId] || !text(value.text, 2000))) return 'Nota inválida.';
  if (kind === 'feedback' && !text(value.text, 4000)) return 'Feedback inválido.';
  if (kind === 'memories' && (!text(value.text,1500) || value.validUntil && !validDate(value.validUntil) || value.validFrom && !validDate(value.validFrom))) return 'Memória inválida.';
  if (kind === 'messages' && (!['user','assistant'].includes(value.role) || !text(value.text,6000) || !text(value.conversationId,200))) return 'Mensagem inválida.';
  if (kind === 'conversations' && (!text(value.title,120) || !validDate(value.date))) return 'Conversa inválida.';
  if (kind === 'cycle' && (value.startDate && !validDate(value.startDate) || value.deloadStart && !validDate(value.deloadStart))) return 'Ciclo inválido.';
  if (kind === 'profile' && (value.id !== 'main' || !finite(value.durationMinutes,15,180) || !Number.isInteger(value.scheduleDay) || !finite(value.scheduleDay,0,6) || !Number.isInteger(value.scheduleHour) || !finite(value.scheduleHour,0,23) || value.timezone !== 'America/Sao_Paulo' || !text(value.context,2000) || !text(value.availability,300))) return 'Perfil inválido.';
  if (kind === 'plans') return validatePlan(value);
  if (kind === 'sessions' && value.snapshot) { try { safeDay(value.dayKey, value.snapshot); } catch { return 'Prescrição de sessão inválida.'; } }
  return null;
}

/* Dados importados ou sincronizados nunca fornecem HTML, URLs ou metadados de UI. */
export function safeDay(dayKey, value) {
  const base = DAYS[dayKey];
  if (!base || !value) return structuredClone(base);
  if (value.kind !== base.kind) return structuredClone(DAYS[value.kind === 'cardio' ? 'aerobico' : dayKey]);
  const result = structuredClone(base);
  if (base.kind !== 'lift') return result;
  result.slots = (value.slots ?? base.slots).map((slot) => {
    if (!Number.isInteger(slot.sets) || !finite(slot.sets,1,6) || !Number.isInteger(slot.reps) || !finite(slot.reps,1,20) || slot.rpe != null && !finite(slot.rpe,6,9) || slot.loadFactor != null && ![0.9,0.95,1].includes(slot.loadFactor) || slot.loadFrom && !validDate(slot.loadFrom) || slot.loadUntil && !validDate(slot.loadUntil)) throw new Error('Prescrição inválida.');
    const original = base.slots.find((s) => [s.exerciseId, ...(s.alternatives ?? [])].includes(slot.exerciseId));
    if (!original) throw new Error('Exercício desconhecido na prescrição.');
    const next = { ...structuredClone(original), slotId: dayKey + ':' + original.exerciseId, exerciseId: slot.exerciseId };
    for (const key of ['sets','reps','rpe','loadFactor','loadFrom','loadUntil']) if (slot[key] != null) next[key] = slot[key];
    if (next.exerciseId !== original.exerciseId) {
      next.note = null;
      next.alternatives = [original.exerciseId, ...(original.alternatives ?? [])].filter((id) => id !== next.exerciseId);
    }
    return next;
  });
  return result;
}
