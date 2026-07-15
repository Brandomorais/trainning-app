/*
 * Camada de persistência — único módulo que toca o IndexedDB.
 * Chaves: logs (array de séries), cycle ({ startDate }), meta.
 */
import { get, set, del } from './vendor/idb-keyval.js';

export const SCHEMA_VERSION = 1;
const APP_ID = 'treino-powerlifting';

const KEYS = { logs: 'logs', cycle: 'cycle', selectedSession: 'selectedSession' };

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

/* ---------- Ciclo ---------- */
export async function getCycle() {
  return (await get(KEYS.cycle)) ?? null;
}

export async function setCycle(cycle) {
  await set(KEYS.cycle, cycle);
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
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'Arquivo inválido.';
  if (data.app !== APP_ID) return 'Este JSON não parece ser um backup deste app.';
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    return `Backup de uma versão mais nova do app (schema ${data.schemaVersion}).`;
  }
  if (!Array.isArray(data.logs)) return 'Backup sem a lista de séries (logs).';
  return null;
}

export async function importData(data) {
  await saveLogs(data.logs);
  if (data.cycle && data.cycle.startDate) await setCycle(data.cycle);
}

export async function wipeAll() {
  await del(KEYS.logs);
  await del(KEYS.cycle);
  await del(KEYS.selectedSession);
}
