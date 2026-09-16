import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { initialPlan } from '../js/plans.js';

const old = { id: 'legacy-1', date: '2026-09-10', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 90, reps: 4, rpe: 8, createdAt: 1, isDeload: false };
await new Promise((resolve, reject) => {
  const request = indexedDB.open('treino-db', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('kv');
  request.onsuccess = () => {
    const tx = request.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put([old], 'logs');
    tx.oncomplete = () => { request.result.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
});
test('migra v1 física sem inventar prescrição ou confirmação de RPE', async () => {
  await db.ready(); const logs = await db.getLogs();
  assert.equal(logs.length, 1); assert.equal(logs[0].id, old.id); assert.equal(logs[0].weight, 90);
  assert.equal(logs[0].rpeSource, 'legacy-unknown'); assert.equal(logs[0].prescription, undefined);
  assert.equal((await db.getPlans()).length, 1);
});
test('gravações simultâneas preservam séries e numeração', async () => {
  const plan = initialPlan();
  const data = { ...old, date: '2026-09-15', planId: plan.id, daySnapshot: plan.days['barra-a'], prescription: plan.days['barra-a'].slots[0] };
  await Promise.all(Array.from({ length: 5 }, () => db.addLog(data)));
  const logs = (await db.getLogs()).filter((l) => l.date === data.date);
  assert.equal(logs.length, 5); assert.deepEqual(logs.map((l) => l.setNumber).sort(), [1,2,3,4,5]);
  assert.equal((await db.getSession(data.date, data.dayKey)).snapshot.slots[0].sets, 4);
});
test('reenvio com edição local durante sincronização mantém a edição pendente', async () => {
  await db.putRecord('memories', { id: 'memory-1', text: 'Primeira versão' });
  const sent = (await db.pendingOperations()).find((x) => x.id === 'memory-1');
  await db.putRecord('memories', { id: 'memory-1', text: 'Segunda versão' });
  await db.acceptSync({ acknowledgements: [{ ...sent, revision: 1 }], changes: [{ kind: 'memories', id: sent.id, value: sent.value, revision: 1, deleted: false }], cursor: 1 });
  assert.equal((await db.getRecord('memories', sent.id)).text, 'Segunda versão');
  const pending = (await db.pendingOperations()).find((x) => x.id === sent.id);
  assert.equal(pending.baseRevision, 1); assert.notEqual(pending.opId, sent.opId);
});
test('exclusão fica na fila e backup não leva credenciais', async () => {
  await db.removeRecord('memories', 'memory-1');
  assert.equal(await db.getRecord('memories', 'memory-1'), null);
  assert.equal((await db.pendingOperations()).find((x) => x.id === 'memory-1').deleted, true);
  await db.setLocal('auth', { access_token: 'secret-test' });
  const backup = await db.exportData();
  assert.equal(backup.schemaVersion, 5); assert.ok(!JSON.stringify(backup).includes('secret-test'));
  assert.equal(db.validateBackup(backup), null);
});
test('backup inválido não substitui dados; restore exige aparelho sem vínculo', async () => {
  const before = (await db.getLogs()).length;
  await assert.rejects(() => db.importData({ app: 'other' }));
  assert.equal((await db.getLogs()).length, before);
  await db.setLocal('owner', 'user-1');
  await assert.rejects(() => db.importData({ app: 'treino-powerlifting', schemaVersion: 1, logs: [old] }), /sem conta/);
  assert.equal((await db.getLogs()).length, before);
});
test('limpeza e restauração v1 preservam cargas e notas', async () => {
  await db.wipeAll();
  await db.importData({ app: 'treino-powerlifting', schemaVersion: 1, logs: [old] });
  assert.equal((await db.getLogs())[0].weight, 90);
  assert.equal(await db.getLocal('auth'), undefined);
  assert.equal(await db.getLocal('owner'), undefined);
});
