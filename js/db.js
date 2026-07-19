/*
 * Camada de persistência — único módulo que toca o IndexedDB.
 * Chaves: logs (séries de força), cardio (sessões aeróbicas),
 * cycle ({ startDate }), selectedSession.
 */
import { get, set, del } from './vendor/idb-keyval.js';

export const SCHEMA_VERSION = 4; // v4: + exerciseNotes (nota por exercício/dia); backups v1-v3 seguem importáveis
const APP_ID = 'treino-powerlifting';

const KEYS = {
  logs: 'logs',
  cardio: 'cardio',
  cycle: 'cycle',
  selectedSession: 'selectedSession',
  settings: 'settings',
  exerciseNotes: 'exerciseNotes',
};

export function newId() {
  return (crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- Séries ---------- */
export async function getLogs() {
  return (await get(KEYS.logs)) ?? [];
}

async function saveLogs(logs) {
  await set(KEYS.logs, logs);
}

export async function addLog({ date, dayKey, exerciseId, setNumber, weight, reps, rpe, notes, isDeload }) {
  const entry = {
    id: newId(),
    date,
    dayKey,
    exerciseId,
    setNumber,
    weight,
    reps,
    rpe: rpe ?? null,
    notes: notes || null,
    isDeload: Boolean(isDeload),
    createdAt: Date.now(),
  };
  const logs = await getLogs();
  logs.push(entry);
  await saveLogs(logs);
  return entry;
}

export async function deleteLog(id) {
  const logs = await getLogs();
  await saveLogs(logs.filter((l) => l.id !== id));
}

/* ---------- Sessões aeróbicas ---------- */
export async function getCardio() {
  return (await get(KEYS.cardio)) ?? [];
}

async function saveCardio(list) {
  await set(KEYS.cardio, list);
}

/* Distância sempre em metros e tempo em segundos; a tela converte. */
export async function addCardio({ date, modality, meters, seconds, notes }) {
  const entry = {
    id: newId(),
    date,
    modality,
    meters,
    seconds,
    notes: notes || null,
    createdAt: Date.now(),
  };
  const list = await getCardio();
  list.push(entry);
  await saveCardio(list);
  return entry;
}

export async function deleteCardio(id) {
  const list = await getCardio();
  await saveCardio(list.filter((c) => c.id !== id));
}

/* ---------- Ciclo ---------- */
export async function getCycle() {
  return (await get(KEYS.cycle)) ?? null;
}

export async function setCycle(cycle) {
  await set(KEYS.cycle, cycle);
}

/* ---------- Notas por exercício/dia ---------- */
/* Uma nota livre por (date, dayKey, exerciseId) — o granulado é o exercício
 * na sessão, não a série. Texto vazio apaga o registro. */
export async function getExerciseNotes() {
  return (await get(KEYS.exerciseNotes)) ?? [];
}

export async function setExerciseNote({ date, dayKey, exerciseId, text }) {
  const notes = await getExerciseNotes();
  const rest = notes.filter(
    (n) => !(n.date === date && n.dayKey === dayKey && n.exerciseId === exerciseId)
  );
  const trimmed = (text ?? '').trim();
  if (trimmed) rest.push({ id: newId(), date, dayKey, exerciseId, text: trimmed, updatedAt: Date.now() });
  await set(KEYS.exerciseNotes, rest);
}

/* ---------- Preferências (unidade por exercício etc.) ---------- */
/* Pesos são sempre GRAVADOS em kg; `units[exerciseId] = 'lb'` só muda a
 * lente de entrada/exibição daquele exercício (máquinas em libras). */
export async function getSettings() {
  return (await get(KEYS.settings)) ?? { units: {} };
}

export async function setSettings(settings) {
  await set(KEYS.settings, settings);
}

/* ---------- Sessão escolhida no dia (expira quando a data muda) ---------- */
export async function getSelectedSession() {
  return (await get(KEYS.selectedSession)) ?? null;
}

export async function setSelectedSession(sel) {
  await set(KEYS.selectedSession, sel);
}

/* ---------- Backup ---------- */
export async function exportData() {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    cycle: await getCycle(),
    logs: await getLogs(),
    cardio: await getCardio(),
    settings: await getSettings(),
    exerciseNotes: await getExerciseNotes(),
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'Arquivo inválido.';
  if (data.app !== APP_ID) return 'Este JSON não parece ser um backup deste app.';
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    return `Backup de uma versão mais nova do app (schema ${data.schemaVersion}).`;
  }
  if (!Array.isArray(data.logs)) return 'Backup sem a lista de séries (logs).';
  if (data.schemaVersion >= 2 && !Array.isArray(data.cardio)) {
    return 'Backup sem a lista de sessões aeróbicas (cardio).';
  }
  return null;
}

export async function importData(data) {
  await saveLogs(data.logs);
  await saveCardio(data.cardio ?? []); // backups v1 entram sem cardio
  await setSettings(data.settings ?? { units: {} }); // backups v1/v2: tudo kg
  await set(KEYS.exerciseNotes, data.exerciseNotes ?? []); // v1-v3: sem notas de exercício
  if (data.cycle && data.cycle.startDate) await setCycle(data.cycle);
}

export async function wipeAll() {
  await del(KEYS.logs);
  await del(KEYS.cardio);
  await del(KEYS.cycle);
  await del(KEYS.selectedSession);
  await del(KEYS.settings);
  await del(KEYS.exerciseNotes);
}
