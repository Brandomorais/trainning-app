import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { connectionHTML } from '../js/views/connection.js';

const conflict = (id, weight) => ({ kind: 'logs', id, deleted: false, revision: 7,
  value: { id, date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight, reps: 4, rpe: 8, createdAt: 1, isDeload: false } });

test('os botões de conflito endereçam o registro, não a posição na lista', async () => {
  await db.ready();
  await db.setLocal('syncConflicts', [conflict('set-a', 100), conflict('set-b', 120)]);
  const html = await connectionHTML();
  // A sincronização de fundo reescreve syncConflicts; um índice apontaria para outro registro.
  assert.match(html, /data-conflict-kind="logs" data-conflict-id="set-a" data-choice="local"/);
  assert.match(html, /data-conflict-kind="logs" data-conflict-id="set-b" data-choice="remote"/);
  assert.doesNotMatch(html, /data-conflict="\d+"/);
});

test('o conflito mostra a versão local ao lado da do servidor', async () => {
  await db.ready();
  await db.putRecord('logs', { id: 'set-a', date: '2026-09-18', dayKey: 'barra-a', exerciseId: 'agacho', setNumber: 1, weight: 95, reps: 4, rpe: 8, createdAt: 1, isDeload: false });
  await db.setLocal('syncConflicts', [conflict('set-a', 100)]);
  const html = await connectionHTML();
  assert.match(html, /Deste aparelho/);
  assert.match(html, /&quot;weight&quot;: 95/);
  assert.match(html, /Do servidor/);
  assert.match(html, /&quot;weight&quot;: 100/);
});
