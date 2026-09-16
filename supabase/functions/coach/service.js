import { initialPlan, buildProposal, planForDate, validatePlan } from '../../../js/plans.js';
import { reviewContext, COACH_INSTRUCTIONS, CHAT_SCHEMA, PROPOSAL_SCHEMA, validateChat } from '../../../js/coach-policy.js';
import { addDaysISO, lastSundayISO } from '../../../js/progression.js';
import { recordError } from '../../../js/records.js';

const CLIENT_KINDS = ['logs','cardio','exerciseNotes','sessions','feedback','memories','conversations','messages','profile','cycle','settings'];
const safeId = (x) => typeof x === 'string' && x.length > 0 && x.length < 200;
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validateOperations(operations) {
  if (!Array.isArray(operations) || operations.length > 100) throw new Error('Lote de sincronização inválido.');
  for (const op of operations) {
    const error = recordError(op.kind, op.value); if (error) throw new Error(error);
    if (!CLIENT_KINDS.includes(op.kind) || !safeId(op.id) || !safeId(op.opId) || !Number.isInteger(op.baseRevision) || op.baseRevision < 0 || typeof op.deleted !== 'boolean' || op.value?.id !== op.id || JSON.stringify(op.value).length > 30000) throw new Error('Registro inválido.');
    if (op.kind === 'messages' && (op.value.role !== 'user' || typeof op.value.text !== 'string' || op.value.text.length > 4000 || !safeId(op.value.conversationId))) throw new Error('Mensagem inválida.');
    if (op.kind === 'logs' && (!Number.isFinite(op.value.weight) || op.value.weight < 0 || !Number.isInteger(op.value.reps) || op.value.reps < 1 || op.value.reps > 10000)) throw new Error('Série inválida.');
  }
}

export async function handleRequest(request, config, fetcher = fetch) {
  const cors = { 'Access-Control-Allow-Origin': config.origin ?? '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!config.supabaseUrl || !config.serviceKey || !config.allowedUser || !config.origin) return json({ error: 'O agente ainda precisa ser configurado no servidor.' }, 503);
  let activeJob = null;
  let userId;
  let usage = null;
  const modelConfig = { ...config, onUsage: (value) => { usage = value; } };
  async function rest(path, body, method = 'POST') {
    const response = await fetcher(config.supabaseUrl + '/rest/v1/' + path, { method, headers: { apikey: config.serviceKey, Authorization: 'Bearer ' + config.serviceKey, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message ?? 'Não foi possível acessar os registros.');
    return result;
  }
  const rpc = (name, body) => rest('rpc/coach_' + name, body);
  const write = (kind, id, value) => rpc('write', { p_user: userId, p_kind: kind, p_id: id, p_value: value });
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 512000) return json({ error: 'Pedido grande demais.' }, 413);
    const raw = await request.text();
    if (raw.length > 512000) return json({ error: 'Pedido grande demais.' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'schedule') {
      if (!config.cronSecret || request.headers.get('x-cron-secret') !== config.cronSecret) return json({ error: 'Acesso negado.' }, 401);
      userId = config.allowedUser;
    } else {
      if (request.headers.get('origin') && request.headers.get('origin') !== config.origin) return json({ error: 'Origem não permitida.' }, 403);
      const token = request.headers.get('authorization');
      if (!token?.startsWith('Bearer ')) return json({ error: 'Entre na sua conta.' }, 401);
      const verified = await fetcher(config.supabaseUrl + '/auth/v1/user', { headers: { apikey: config.serviceKey, Authorization: token } });
      const user = await verified.json();
      if (!verified.ok || user.id !== config.allowedUser) return json({ error: 'Conta não autorizada.' }, 403);
      userId = user.id;
    }
    await rpc('bootstrap', { p_user: userId, p_plan: initialPlan() });
    if (body.action === 'erase') {
      if (body.confirmation !== 'EXCLUIR') throw new Error('Confirme a exclusão no app.');
      await rpc('erase', { p_user: userId });
      return json({ deleted: true });
    }
    if (body.action === 'sync') {
      validateOperations(body.operations);
      if (!Number.isInteger(body.cursor) || body.cursor < 0) throw new Error('Cursor inválido.');
      return json(await rpc('sync', { p_user: userId, p_operations: body.operations, p_cursor: body.cursor, p_epoch: body.epoch ?? null }));
    }
    if (body.action === 'adopt') {
      if (!Array.isArray(body.plans) || !Array.isArray(body.reviews) || body.plans.length > 200 || body.reviews.length > 200) throw new Error('Arquivo de planos inválido.');
      for (const plan of body.plans) { const error = validatePlan(plan); if (error) throw new Error(error); }
      for (const review of body.reviews) if (!safeId(review.id) || !body.plans.some((p) => p.id === review.planId)) throw new Error('Revisão sem plano correspondente.');
      await rpc('adopt', { p_user: userId, p_plans: body.plans, p_reviews: body.reviews });
      return json({ restored: true });
    }
    if (body.action === 'apply' || body.action === 'reject') {
      if (!safeId(body.reviewId)) throw new Error('Proposta inválida.');
      return json(await rpc('decide', { p_user: userId, p_review_id: body.reviewId, p_apply: body.action === 'apply' }));
    }
    const bundle = await rpc('bundle', { p_user: userId });
    const data = bundle.data;
    const date = localDate();
    if (body.action === 'schedule') {
      const profile = data.profile?.find((p) => p.id === 'main');
      if (!profile?.scheduleEnabled) return json({ skipped: true });
      const week = lastSundayISO(new Date(date + 'T12:00:00'));
      const due = addDaysISO(week, Number(profile.scheduleDay ?? 6));
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
      if (date < due || (date === due && hour < Number(profile.scheduleHour ?? 18))) return json({ skipped: true });
      const id = 'scheduled:' + week;
      if ((data.conversations ?? []).some((c) => c.id === id)) return json({ skipped: true });
      const context = reviewContext(data, date);
      await rpc('schedule', { p_user: userId,
        p_conversation: { id, title: 'Revisão semanal preparada', purpose: 'weekly', date, createdAt: Date.now() },
        p_message: { id: id + ':question', conversationId: id, role: 'assistant', kind: 'ask_question', text: 'Sua revisão semanal está disponível. Tenho ' + context.logs.length + ' séries registradas nas últimas seis semanas. Como estará sua disponibilidade para a próxima semana?', options: ['Mesmos dias e horários', 'Terei menos tempo', 'Vou viajar'], createdAt: Date.now(), source: 'scheduled-checkin' },
      });
      return json({ prepared: true });
    }
    if (!['converse', 'propose', 'restore'].includes(body.action) || !safeId(body.requestId)) throw new Error('Ação inválida.');
    const persisted = body.action === 'converse' ? data.messages?.find((m) => m.id === 'reply:' + body.requestId) : data.reviews?.find((r) => r.id === 'review:' + body.requestId);
    if (persisted) {
      if (body.action === 'restore' && persisted.status === 'proposed') return json(await rpc('decide', { p_user: userId, p_review_id: persisted.id, p_apply: true }));
      return json(persisted);
    }
    if (body.action !== 'restore' && (!config.openaiKey || !config.model)) return json({ error: 'A conexão com a IA ainda precisa ser configurada no servidor.' }, 503);
    const claim = await rpc('claim_job', { p_user: userId, p_id: body.requestId, p_action: body.action, p_daily_limit: Math.max(1, Math.min(config.dailyLimit ?? 40, 200)) });
    if (claim.cached) return json(claim.result);
    activeJob = body.requestId;
    const context = reviewContext(data, date);
    let result;
    if (body.action === 'restore') {
      const source = data.plans?.find((p) => p.id === body.planId && p.status === 'applied');
      if (!source || body.effectiveFrom !== context.targetWeek) throw new Error('Escolha um plano aplicado para a próxima semana.');
      const base = planForDate(data.plans, context.targetWeek);
      const plan = { ...structuredClone(source), id: 'plan:' + body.requestId, parentId: base.id, status: 'proposed', effectiveFrom: context.targetWeek, createdAt: Date.now(), summary: 'Restauração solicitada pelo usuário: ' + source.summary, changes: [] };
      for (const day of Object.values(plan.days)) for (const slot of day.slots ?? []) { delete slot.loadFactor; delete slot.loadFrom; delete slot.loadUntil; }
      const error = validatePlan(plan); if (error) throw new Error(error);
      const review = { id: 'review:' + body.requestId, planId: plan.id, status: 'proposed', createdAt: Date.now(), source: 'restore' };
      await rpc('commit_review', { p_user: userId, p_review: review, p_plan: plan, p_revision: bundle.revision });
      result = await rpc('decide', { p_user: userId, p_review_id: review.id, p_apply: true });
    } else {
      const conversation = data.conversations?.find((c) => c.id === body.conversationId);
      if (!conversation) throw new Error('Conversa não encontrada. Sincronize novamente.');
      const messages = (data.messages ?? []).filter((m) => m.conversationId === conversation.id).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      const last = messages.at(-1);
      if (body.action === 'converse') {
        if (last?.id !== body.messageId || last.role !== 'user') throw new Error('A conversa foi atualizada. Reabra para continuar.');
        const output = validateChat(await modelResponse(CHAT_SCHEMA, 'coach_reply', COACH_INSTRUCTIONS, { context, purpose: conversation.purpose, messages: messages.slice(-40) }, modelConfig, fetcher));
        result = { id: 'reply:' + body.requestId, conversationId: conversation.id, role: 'assistant', ...output, createdAt: Date.now(), model: config.model, usage };
        await rpc('commit_reply', { p_user: userId, p_value: result, p_revision: bundle.revision });
      } else {
        if (last?.id !== body.summaryId || last.role !== 'assistant' || last.kind !== 'summarize') throw new Error('Confirme um resumo atualizado antes de gerar a proposta.');
        const base = planForDate(data.plans, context.targetWeek);
        context.plan = base;
        const output = await modelResponse(PROPOSAL_SCHEMA, 'weekly_plan', COACH_INSTRUCTIONS + '\nGere uma proposta para targetWeek. Cada ajuste deve citar IDs existentes dos registros ou mensagens. Limites: séries mudam no máximo 1, reps no máximo 2, RPE no máximo 1 (6 a 9), loadFactor somente 0.9, 0.95 ou 1. Pode manter valores com null. Use apenas alternativas do slot. Preserve funções primary/volume/technique. A agenda deve ter sete dias e não repetir sessões de força. Pode manter todo o plano com changes vazio. Nenhum aumento de carga é decidido aqui: o motor de progressão calcula as cargas. Não aplique deload via loadFactor. Respeite toda limitação confirmada; se não houver solução, mantenha e explique.', { context, messages: messages.slice(-40) }, modelConfig, fetcher);
        if (output.effectiveFrom !== context.targetWeek) throw new Error('O agente retornou uma semana incorreta. Peça um novo resumo.');
        const evidence = {};
        for (const kind of ['logs','cardio','sessions','feedback','exerciseNotes','memories','messages','profile']) {
          for (const item of data[kind] ?? []) evidence[item.id] = item.text ?? [item.date, item.dayKey, item.exerciseId, item.weight != null ? item.weight + ' kg × ' + item.reps : '', item.reason ?? ''].filter(Boolean).join(' · ');
        }
        if (output.changes.some((c) => c.evidenceIds.some((id) => !(id in evidence)))) throw new Error('O agente citou um registro inexistente. Peça um novo resumo.');
        const plan = buildProposal(base, output, { id: 'plan:' + body.requestId });
        result = { id: 'review:' + body.requestId, conversationId: conversation.id, planId: plan.id, status: 'proposed', createdAt: Date.now(), summary: plan.summary, evidence, model: config.model, usage };
        await rpc('commit_review', { p_user: userId, p_review: result, p_plan: plan, p_revision: bundle.revision });
      }
    }
    await rpc('finish_job', { p_user: userId, p_id: activeJob, p_result: result });
    return json(result);
  } catch (error) {
    if (activeJob) await rpc('finish_job', { p_user: userId, p_id: activeJob, p_result: { error: 'Falha recuperável.' }, p_failed: true }).catch(() => {});
    let message = error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
    for (const secret of [config.serviceKey, config.openaiKey, config.cronSecret, request.headers.get('authorization')?.replace(/^Bearer /, '')]) {
      if (secret) message = message.split(secret).join('[credencial omitida]');
    }
    return json({ error: message }, 400);
  }
}

export async function modelResponse(schema, name, instructions, input, config, fetcher = fetch) {
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: 'Bearer ' + config.openaiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, instructions, input: JSON.stringify(input), store: false, max_output_tokens: name === 'weekly_plan' ? 6000 : 2000, text: { format: { type: 'json_schema', name, strict: true, schema } } }), signal: AbortSignal.timeout(65000),
  });
  const result = await response.json();
  config.onUsage?.(result.usage ?? null);
  if (!response.ok || result.status !== 'completed') throw new Error('A IA não concluiu a resposta. Seus registros foram preservados; tente novamente.');
  const contents = (result.output ?? []).flatMap((item) => item.content ?? []);
  if (contents.some((item) => item.type === 'refusal')) throw new Error('O agente não pôde atender esse pedido. Reformule a mensagem.');
  const text = contents.filter((item) => item.type === 'output_text').map((item) => item.text).join('');
  try { return JSON.parse(text); } catch { throw new Error('A resposta veio incompleta. Tente novamente.'); }
}
