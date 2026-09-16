import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureConnection } from '../js/api.js';
import { handleRequest } from '../supabase/functions/coach/service.js';

test('configuração do navegador rejeita chaves privadas', async () => {
  const url = 'https://example.supabase.co';
  for (const key of ['sk-' + 'x'.repeat(30), 'sb_secret_' + 'x'.repeat(30),
    'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature']) {
    await assert.rejects(configureConnection(url, key), /pública/);
  }
});

test('erro remoto não devolve segredos nem token de sessão', async () => {
  const config = { supabaseUrl: 'https://example.supabase.co', origin: 'https://example.com', allowedUser: 'owner', serviceKey: 'private-service-fixture', openaiKey: 'private-ai-fixture', cronSecret: 'private-cron-fixture' };
  const token = 'private-session-fixture';
  const response = await handleRequest(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'sync' }) }), config, async (url) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' });
    return Response.json({ message: [config.serviceKey, config.openaiKey, config.cronSecret, token].join(' ') }, { status: 500 });
  });
  const text = await response.text();
  for (const secret of [config.serviceKey, config.openaiKey, config.cronSecret, token]) assert.ok(!text.includes(secret));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
