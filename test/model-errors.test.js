import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelResponse } from '../supabase/functions/coach/service.js';
for (const [status, body, expected] of [
  [429, { error: { code: 'insufficient_quota' } }, /sem saldo ou cota/],
  [401, { error: {} }, /chave.*recusada/],
  [404, { error: { code: 'model_not_found' } }, /modelo configurado/],
  [429, { error: { code: 'rate_limit_exceeded' } }, /limite temporário/],
  [400, { error: {} }, /configuração do pedido/],
  [200, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }, /limite de geração/],
  [503, { error: {} }, /mais tarde/],
]) {
  test(`erro da IA ${status}: ${expected}`, async () => {
    if (body.error) body.error.message = 'private-key-fixture';
    await assert.rejects(modelResponse({}, 'coach_reply', '', {}, { openaiKey: 'private-key-fixture' }, async () => Response.json(body, { status })), (error) => {
      assert.match(error.message, expected);
      assert.ok(!error.message.includes('private-key-fixture'));
      return true;
    });
  });
}
