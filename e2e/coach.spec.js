import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { handleRequest } from '../supabase/functions/coach/service.js';

test('treino, feedback e memória ficam disponíveis sem conexão', async ({ page, context }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/treino/barra-a');
  await expect(page.getByRole('heading', { name:'Barra A — Agacho pesado' })).toBeVisible();
  const card = page.locator('.exercise').first();
  await expect(card.locator('.rpe-btn.selected')).toHaveAttribute('data-rpe','');
  await card.locator('.in-weight').fill('90');
  await card.locator('[data-rpe="8"]').click();
  await card.locator('.log-btn').click();
  await expect(card.locator('.set-chip')).toContainText('90×4');
  await page.locator('#session-feedback').fill('Faltou tempo para terminar.');
  await page.locator('#interrupt-session').click();
  await expect(page.getByText('Treino interrompido · Faltou tempo')).toBeVisible();
  await page.locator('#tabs a[href="#/agente"]').click();
  await page.locator('#agent-text').fill('Semana que vem só tenho 45 minutos.');
  await page.locator('#agent-form button[type=submit]').click();
  await expect(page.locator('.from-user')).toContainText('45 minutos');
  await page.getByText('O que o agente sabe sobre mim', { exact:true }).click();
  await page.locator('#memory-text').fill('Prefiro treinar pela manhã.');
  await page.locator('#memory-form button').click();
  await page.reload();
  await expect(page.locator('.from-user')).toContainText('45 minutos');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Espera a navegação passar a ser controlada pelo service worker instalado.
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.from-user')).toContainText('45 minutos');
  await page.locator('#tabs a[href="#/treinos"]').click();
  await expect(page.getByRole('heading',{ name:'Treinos',exact:true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('conversa remota, resumo, proposta e aprovação usando banco real e IA simulada', async ({ page }) => {
  const pg = new PGlite();
  const user = '11111111-1111-4111-8111-111111111111';
  await pg.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  await pg.exec(await readFile(new URL('../supabase/migrations/202609150001_coach.sql', import.meta.url),'utf8'));
  await pg.query('insert into auth.users values($1)', [user]);
  const config = { supabaseUrl:'https://example.supabase.co', serviceKey:'test-server-only', allowedUser:user, origin:'http://127.0.0.1:5173', openaiKey:'test-mock-only', model:'fixture' };
  let aiCalls = 0;
  const fakeFetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id:user });
    if (String(url).includes('/rest/v1/rpc/')) {
      const name = String(url).split('/').at(-1);
      const params = JSON.parse(options.body);
      const keys = Object.keys(params);
      try {
        const result = await pg.query('select public.' + name + '(' + keys.map((k,i) => k + ' => $' + (i+1)).join(',') + ') result', Object.values(params));
        return Response.json(result.rows[0].result);
      } catch(error) { return Response.json({ message:error.message }, { status:400 }); }
    }
    if (url === 'https://api.openai.com/v1/responses') {
      aiCalls++;
      const request = JSON.parse(options.body); const input = JSON.parse(request.input);
      const message = input.messages.at(-1);
      const answer = request.text.format.name === 'weekly_plan'
        ? { summary:'Uma série a menos no agacho conforme sua disponibilidade.', effectiveFrom:input.context.targetWeek, weekdays:null, changes:[{ dayKey:'barra-a', slotId:'barra-a:agacho', exerciseId:null, sets:3, reps:null, rpe:null, loadFactor:null, reason:'Você informou menos tempo disponível.', evidenceIds:[input.messages.find((m) => m.role==='user').id] }] }
        : input.messages.filter((m) => m.role==='user').length > 1
          ? { kind:'summarize', text:'Entendi: você terá 45 minutos por treino. Vou considerar isso na próxima semana.', options:[] }
          : { kind:'ask_question', text:'Quanto tempo você terá por treino na próxima semana?', options:['45 minutos','60 minutos'] };
      return Response.json({ status:'completed', output:[{ content:[{ type:'output_text', text:JSON.stringify(answer) }] }] });
    }
    throw new Error('Requisição inesperada: ' + url);
  };
  await page.route('https://example.supabase.co/**', async (route) => {
    const request = route.request();
    if (request.url().includes('/auth/v1/token')) {
      await route.fulfill({ json:{ access_token:'mock-access', refresh_token:'mock-refresh', expires_in:3600, user:{ id:user, email:'treino@example.test' } }, headers:{ 'access-control-allow-origin':config.origin } }); return;
    }
    const response = await handleRequest(new Request(request.url(), { method:request.method(), headers:request.headers(), ...(request.method()==='POST' ? { body:request.postData() } : {}) }), config, fakeFetch);
    await route.fulfill({ status:response.status, headers:Object.fromEntries(response.headers), body:await response.text() });
  });
  try {
    await page.goto('/#/config');
    await page.locator('#remote-url').fill(config.supabaseUrl);
    await page.locator('#remote-public-key').fill('sb_publishable_testonly');
    await page.locator('#account-email').fill('treino@example.test');
    await page.locator('#account-password').fill('local-fixture-only');
    await page.locator('#sign-in').click();
    await expect(page.locator('.sync-label')).toContainText('Conta conectada');
    await page.locator('#tabs a[href="#/agente"]').click();
    await page.getByRole('button',{ name:'Revisar semana',exact:true }).click();
    await expect(page.locator('.from-agent')).toContainText('Quanto tempo');
    await page.getByRole('button',{ name:'45 minutos',exact:true }).click();
    await expect(page.locator('#generate-proposal')).toBeVisible();
    await page.locator('#generate-proposal').click();
    await expect(page.locator('.proposal-card')).toContainText('Uma série a menos');
    await page.locator('[data-apply]').click();
    await expect(page.locator('.agent-notice')).toContainText('Próxima semana aplicada');
    const { rows } = await pg.query("select value from coach_records where kind='plans' and value->>'status'='applied'");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.value.id !== 'program-initial-v1').value.days['barra-a'].slots[0].sets).toBe(3);
    expect(aiCalls).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await pg.close(); }
});
