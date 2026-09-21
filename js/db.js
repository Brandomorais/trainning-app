import { transact, requestValue as req } from './storage.js';
import { initialPlan, planForDate, validatePlan, validDate, clone } from './plans.js';
import { recordError } from './records.js';

export const SCHEMA_VERSION = 5;
const APP_ID = 'treino-powerlifting';
export const KINDS = ['logs', 'cardio', 'exerciseNotes', 'sessions', 'feedback', 'memories', 'conversations', 'messages', 'profile', 'cycle', 'settings', 'plans', 'reviews'];
const REMOTE_ONLY = new Set(['plans', 'reviews']);
// Entidades independentes podem coexistir quando dois aparelhos alteram o
// mesmo id. Registros estruturais/singletons continuam exigindo uma escolha.
export const KEEP_BOTH_KINDS = new Set(['logs', 'cardio', 'exerciseNotes', 'feedback', 'memories', 'messages']);
let migration;
export function newId() { return crypto.randomUUID(); }
const row = (kind, value, revision = 0, deleted = false) => ({ kind, id: value.id, value, revision, deleted });
export function ready() {
  if (!migration) migration = transact('readwrite', async (tx) => {
    if (await req(tx.meta.get('schema5'))) return;
    for (const kind of ['logs', 'cardio', 'exerciseNotes']) {
      for (const old of (await req(tx.meta.get(kind))) ?? []) {
        const value = { ...old, id: old.id ?? newId() };
        if (kind === 'logs') { value.rpeSource ??= 'legacy-unknown'; value.legacy = true; }
        tx.records.put(row(kind, value));
        tx.outbox.put({ kind, id: value.id, opId: newId(), baseRevision: 0, value, deleted: false });
      }
    }
    for (const kind of ['cycle', 'settings']) {
      const old = await req(tx.meta.get(kind));
      if (old) {
        const value = { ...old, id: 'main' };
        tx.records.put(row(kind, value));
        tx.outbox.put({ kind, id: 'main', opId: newId(), baseRevision: 0, value, deleted: false });
      }
    }
    tx.records.put(row('plans', initialPlan()));
    tx.meta.put(true, 'schema5');
  }).catch((error) => { migration = null; throw error; });
  return migration;
}
export async function list(kind) {
  await ready();
  return transact('readonly', async ({ records }) => (await req(records.index('kind').getAll(kind))).filter((r) => !r.deleted).map((r) => r.value));
}
export async function getRecord(kind, id) {
  await ready();
  return transact('readonly', async ({ records }) => { const r = await req(records.get([kind, id])); return r && !r.deleted ? r.value : null; });
}
async function write(tx, kind, value, deleted = false) {
  if (!KINDS.includes(kind) || REMOTE_ONLY.has(kind)) throw new Error('Tipo de registro inválido.');
  const error = recordError(kind, value); if (error) throw new Error(error);
  const old = await req(tx.records.get([kind, value.id]));
  const next = { ...value, updatedAt: Date.now() };
  tx.records.put(row(kind, next, old?.revision ?? 0, deleted));
  tx.outbox.put({ kind, id: value.id, opId: newId(), baseRevision: old?.revision ?? 0, value: next, deleted });
  return next;
}
export async function putRecord(kind, value) {
  await ready();
  return transact('readwrite', (tx) => write(tx, kind, { ...value, id: value.id ?? newId() }));
}
export async function removeRecord(kind, id) {
  await ready();
  return transact('readwrite', async (tx) => {
    const old = await req(tx.records.get([kind, id]));
    if (old) await write(tx, kind, old.value, true);
  });
}
export async function getLocal(key) { await ready(); return transact('readonly', ({ meta }) => req(meta.get(key))); }
export async function setLocal(key, value) { await ready(); return transact('readwrite', ({ meta }) => { meta.put(value, key); }); }
export const getLogs = () => list('logs');
export const getCardio = () => list('cardio');
export const getExerciseNotes = () => list('exerciseNotes');
export const getCycle = () => getRecord('cycle', 'main');
export const setCycle = (value) => putRecord('cycle', { ...value, id: 'main' });
export const getSettings = async () => (await getRecord('settings', 'main')) ?? { units: {} };
export const setSettings = (value) => putRecord('settings', { ...value, id: 'main' });
export const getSelectedSession = () => getLocal('selectedSession');
export const setSelectedSession = (value) => setLocal('selectedSession', value);
export const getPlans = () => list('plans');
export const getPlan = async (date) => planForDate(await getPlans(), date);
export const sessionId = (date, dayKey) => 'session:' + date + ':' + dayKey;
export const getSession = (date, dayKey) => getRecord('sessions', sessionId(date, dayKey));

export async function addLog(input) {
  await ready();
  if (!validDate(input.date) || !Number.isFinite(input.weight) || input.weight < 0 || !Number.isInteger(input.reps) || input.reps < 1) throw new Error('Série inválida.');
  return transact('readwrite', async (tx) => {
    const id = sessionId(input.date, input.dayKey);
    const previous = await req(tx.records.get(['sessions', id]));
    if (!previous || previous.deleted) await write(tx, 'sessions', {
      id, date: input.date, dayKey: input.dayKey, planId: input.planId ?? null,
      snapshot: input.daySnapshot ?? null, isDeload: Boolean(input.isDeload), status: 'in_progress', startedAt: Date.now(),
    });
    const existing = (await req(tx.records.index('kind').getAll('logs'))).filter((r) => !r.deleted && r.value.date === input.date && r.value.dayKey === input.dayKey && r.value.exerciseId === input.exerciseId);
    const { daySnapshot, ...rest } = input;
    return write(tx, 'logs', {
      ...rest, id: newId(), sessionId: id, setNumber: existing.length + 1,
      rpe: input.rpe ?? null, rpeSource: input.rpe == null ? 'missing' : 'confirmed',
      isDeload: Boolean(input.isDeload), createdAt: Date.now(),
    });
  });
}
export const deleteLog = (id) => removeRecord('logs', id);
export const addCardio = (input) => putRecord('cardio', { ...input, id: newId(), createdAt: Date.now() });
export const deleteCardio = (id) => removeRecord('cardio', id);
export async function setExerciseNote({ date, dayKey, exerciseId, text }) {
  await ready();
  return transact('readwrite', async (tx) => {
    const notes = await req(tx.records.index('kind').getAll('exerciseNotes'));
    const old = notes.find((r) => !r.deleted && r.value.date === date && r.value.dayKey === dayKey && r.value.exerciseId === exerciseId);
    const value = { id: old?.id ?? ['note', date, dayKey, exerciseId].join(':'), date, dayKey, exerciseId, text: (text ?? '').trim() };
    return write(tx, 'exerciseNotes', value, !value.text);
  });
}
export async function completeSession(date, dayKey, status, reason = '') {
  if (!['completed', 'interrupted'].includes(status)) throw new Error('Estado de sessão inválido.');
  const session = await getSession(date, dayKey);
  if (!session) throw new Error('Registre uma série antes de concluir o treino.');
  return putRecord('sessions', { ...session, status, reason, finishedAt: Date.now() });
}
export async function exportData() {
  await ready();
  return transact('readonly', async ({ records }) => {
    const all = (await req(records.getAll())).filter((r) => !r.deleted);
    const entities = Object.fromEntries(KINDS.map((k) => [k, all.filter((r) => r.kind === k).map((r) => r.value)]));
    return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...entities, cycle: entities.cycle[0] ?? null, settings: entities.settings[0] ?? { units: {} } };
  });
}
export function validateBackup(data) {
  if (!data || data.app !== APP_ID) return 'Este JSON não é um backup deste app.';
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1 || data.schemaVersion > SCHEMA_VERSION) return 'Versão de backup não suportada.';
  if (!Array.isArray(data.logs) || (data.schemaVersion >= 2 && !Array.isArray(data.cardio))) return 'Backup sem os registros de treino.';
  for (const kind of KINDS.filter((k) => !['cycle', 'settings'].includes(k))) {
    const values = data[kind] ?? [];
    if (!Array.isArray(values)) return 'Lista inválida: ' + kind;
    const ids = new Set();
    for (const v of values) {
      if (!v || typeof v.id !== 'string' || !v.id || ids.has(v.id)) return 'Identificador inválido ou duplicado em ' + kind;
      const error = recordError(kind, v); if (error) return error;
      ids.add(v.id);
      if (['logs', 'cardio', 'exerciseNotes'].includes(kind) && !validDate(v.date)) return 'Data inválida no backup.';
      if (kind === 'logs' && (!Number.isFinite(v.weight) || v.weight < 0 || !Number.isInteger(v.reps) || v.reps < 1)) return 'Carga ou repetições inválidas.';
      if (kind === 'plans' && validatePlan(v)) return validatePlan(v);
    }
  }
  return null;
}
export async function importData(data) {
  const error = validateBackup(data); if (error) throw new Error(error);
  await ready();
  return transact('readwrite', async (tx) => {
    if (await req(tx.meta.get('owner'))) throw new Error('A restauração exige um aparelho sem conta vinculada; não substitui a nuvem. Exporte os dados atuais antes de limpar este aparelho.');
    tx.records.clear(); tx.outbox.clear();
    for (const kind of KINDS) {
      const values = ['cycle', 'settings'].includes(kind) ? (data[kind] ? [{ ...data[kind], id: 'main' }] : []) : (data[kind] ?? []);
      for (const old of values) {
        const value = clone(old);
        if (kind === 'logs') value.rpeSource ??= 'legacy-unknown';
        tx.records.put(row(kind, value));
        if (!REMOTE_ONLY.has(kind)) tx.outbox.put({ kind, id: value.id, opId: newId(), baseRevision: 0, value, deleted: false });
      }
    }
    if (!data.plans?.length) tx.records.put(row('plans', initialPlan()));
    tx.meta.put(Boolean(data.plans?.some((p) => p.id !== initialPlan().id)), 'restorePlans');
    tx.meta.delete('selectedSession'); tx.meta.delete('syncCursor');
  });
}
export async function wipeAll() {
  await ready();
  return transact('readwrite', ({ records, outbox, meta }) => {
    records.clear(); outbox.clear(); meta.clear(); meta.put(true, 'schema5');
    records.put(row('plans', initialPlan()));
  });
}
export async function pendingOperations() { await ready(); return transact('readonly', ({ outbox }) => req(outbox.getAll())); }
export async function acceptSync({ acknowledgements = [], changes = [], cursor, conflicts = [], epoch }) {
  await ready();
  return transact('readwrite', async (tx) => {
    for (const ack of acknowledgements) {
      const key = [ack.kind, ack.id];
      const local = await req(tx.records.get(key));
      const pending = await req(tx.outbox.get(key));
      if (local) tx.records.put({ ...local, revision: ack.revision });
      if (pending?.opId === ack.opId) tx.outbox.delete(key);
      else if (pending) tx.outbox.put({ ...pending, baseRevision: ack.revision });
    }
    for (const remote of changes) {
      if (!KINDS.includes(remote.kind)) continue;
      const error = recordError(remote.kind, remote.value); if (error) throw new Error('Dados remotos inválidos: ' + error);
      const key = [remote.kind, remote.id];
      const pending = await req(tx.outbox.get(key));
      if (!pending) tx.records.put({ kind: remote.kind, id: remote.id, value: remote.value, deleted: remote.deleted, revision: remote.revision });
    }
    tx.meta.put(cursor, 'syncCursor');
    if (epoch) tx.meta.put(epoch, 'syncEpoch');
    tx.meta.put(conflicts, 'syncConflicts');
    tx.meta.put(Date.now(), 'lastSync');
  });
}
export async function resolveConflict(kind, id, choice) {
  await ready();
  return transact('readwrite', async (tx) => {
    const conflicts = (await req(tx.meta.get('syncConflicts'))) ?? [];
    const conflict = conflicts.find((c) => c.kind === kind && c.id === id);
    if (!conflict) return;
    if (choice === 'both') {
      if (!KEEP_BOTH_KINDS.has(kind) || conflict.deleted) throw new Error('Este tipo de alteração exige escolher uma das versões.');
      const local = await req(tx.records.get([kind, id]));
      if (!local || local.deleted) throw new Error('Não há duas versões ativas para preservar.');
      const copy = { ...local.value, id: newId(), updatedAt: Date.now() };
      const error = recordError(kind, copy); if (error) throw new Error(error);
      tx.records.put(row(kind, copy));
      tx.outbox.put({ kind, id: copy.id, opId: newId(), baseRevision: 0, value: copy, deleted: false });
      tx.outbox.delete([kind, id]);
      tx.records.put({ kind, id, value: conflict.value, deleted: false, revision: conflict.revision });
    } else if (choice === 'remote') {
      tx.outbox.delete([kind, id]); tx.records.put({ kind, id, value: conflict.value, deleted: conflict.deleted, revision: conflict.revision });
    } else {
      const pending = await req(tx.outbox.get([kind, id]));
      if (pending) tx.outbox.put({ ...pending, opId: newId(), baseRevision: conflict.revision });
    }
    tx.meta.put(conflicts.filter((c) => !(c.kind === kind && c.id === id)), 'syncConflicts');
  });
}
