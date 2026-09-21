import { list, getLocal, getRecord, setLocal, putRecord, removeRecord, newId, getPlans, resolveConflict, KEEP_BOTH_KINDS } from '../db.js';
import { api } from '../api.js';
import { syncNow } from '../sync.js';
import { toISODate, formatDateShort, lastSundayISO, addDaysISO } from '../progression.js';
import { EXERCISES } from '../program.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prescription = (s) => `${EXERCISES[s.exerciseId]?.name ?? s.exerciseId} · ${s.sets}×${s.reps}${s.rpe ? ' @' + s.rpe : ''}${s.loadFactor && s.loadFactor < 1 ? ' · carga sugerida −' + Math.round((1 - s.loadFactor) * 100) + '%' : ''}`;
let busy = false;
let message = '';
let pendingMode = null;
// Rascunho vivo: o storage só repõe o texto ao reabrir o app, e sua leitura é
// assíncrona demais para servir de fonte durante a digitação.
let draftText = null;

export async function render(el) {
  const [conversations, allMessages, reviews, memories, plans, auth, selected, draft, conflicts] = await Promise.all([
    list('conversations'), list('messages'), list('reviews'), list('memories'), getPlans(), getLocal('auth'), getLocal('activeConversation'), getLocal('agentDraft'), getLocal('syncConflicts'),
  ]);
  const disputed = await Promise.all((conflicts ?? []).map(async (c) => ({ ...c, local: await getRecord(c.kind, c.id) })));
  const composing = pendingMode !== null;
  const conversation = composing ? null : (conversations.find((c) => c.id === selected) ?? conversations.sort((a, b) => b.createdAt - a.createdAt)[0]);
  const messages = conversation ? allMessages.filter((m) => m.conversationId === conversation.id).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)) : [];
  const latest = messages.at(-1);
  const waiting = latest?.role === 'user';
  const pendingReviews = reviews.filter((r) => r.status === 'proposed').sort((a, b) => b.createdAt - a.createdAt);
  const date = toISODate();
  const hasConversation = Boolean(conversation && messages.length);
  el.innerHTML = `
    <header class="page-head agent-head"><div><h1>Agente</h1><p class="muted small">Ajuste o treino com base no que aconteceu de verdade.</p></div><a class="back-link" href="#/config">Config</a></header>
    ${!auth ? '<div class="banner-info">Você pode salvar seu feedback agora. Para receber perguntas e ajustes da IA, conecte sua conta em Configurações.</div>' : ''}
    ${disputed.length ? `<section class="card conflict agent-conflicts"><h2>Resolver alterações entre aparelhos</h2><p class="muted small">Escolha o que deve entrar no contexto do agente. Nada será descartado sem sua decisão.</p>${disputed.map((c) => `<div class="conflict"><strong>${esc(c.kind)}</strong><details><summary>Comparar versões</summary><p class="small">Deste aparelho</p><pre>${esc(c.local ? JSON.stringify(c.local, null, 2) : 'Registro apagado neste aparelho.')}</pre><p class="small">Do servidor</p><pre>${esc(c.deleted ? 'Registro apagado no servidor.' : JSON.stringify(c.value, null, 2))}</pre></details><div class="action-row"><button class="btn" data-agent-conflict-kind="${esc(c.kind)}" data-agent-conflict-id="${esc(c.id)}" data-choice="local">Deste aparelho</button><button class="btn" data-agent-conflict-kind="${esc(c.kind)}" data-agent-conflict-id="${esc(c.id)}" data-choice="remote">Do servidor</button>${KEEP_BOTH_KINDS.has(c.kind) && c.local && !c.deleted ? `<button class="btn btn-primary" data-agent-conflict-kind="${esc(c.kind)}" data-agent-conflict-id="${esc(c.id)}" data-choice="both">Preservar as duas</button>` : ''}</div></div>`).join('')}</section>` : ''}
    ${!hasConversation && !composing ? `<section class="card agent-start">
      <span class="agent-kicker">PRÓXIMA SEMANA</span>
      <h2>Como devemos ajustar seu treino?</h2>
      <p class="muted">Responda algumas perguntas. Você confere a proposta antes de qualquer mudança.</p>
      <button class="btn btn-primary agent-main-action" data-start="weekly">Revisar semana</button>
      <div class="agent-secondary-actions"><button class="btn" data-start="session">Registrar feedback</button><button class="btn" data-start="free">Fazer uma pergunta</button></div>
    </section>` : `<div class="agent-toolbar"><button class="btn" data-start="weekly">Revisar semana</button><button class="btn" data-start="session">Registrar feedback</button><button class="btn" data-start="free">Nova conversa</button></div>`}
    ${conversations.length > 1 ? `<details class="conversation-picker"><summary>Trocar de conversa</summary><label class="field"><span>Conversa</span><select id="conversation-select">${conversations.sort((a, b) => b.createdAt - a.createdAt).map((c) => `<option value="${esc(c.id)}"${c.id === conversation?.id ? ' selected' : ''}>${esc(c.title)} · ${esc(c.date)}</option>`).join('')}</select></label></details>` : ''}
    <section class="agent-thread" aria-label="Conversa com o agente" aria-live="polite">
      ${messages.map((m) => `<article class="agent-bubble ${m.role === 'user' ? 'from-user' : 'from-agent'}"><span class="bubble-author">${m.role === 'user' ? 'Você' : 'Agente'}</span><p>${esc(m.text)}</p></article>`).join('')}
      ${busy ? '<p class="agent-status" role="status">Analisando seus registros e respostas…</p>' : ''}
    </section>
    ${message ? `<p class="agent-notice" role="status">${esc(message)}</p>` : ''}
    ${!busy && latest?.role === 'assistant' && latest.options?.length ? `<div class="quick-replies">${latest.options.map((option, i) => `<button class="btn" data-answer="${i}">${esc(option)}</button>`).join('')}</div>` : ''}
    <form id="agent-form" class="agent-composer">
      <label class="field" for="agent-text"><span>${composing ? 'Sua pergunta' : hasConversation ? 'Sua resposta' : 'Quer contar mais alguma coisa?'}</span><textarea id="agent-text" rows="3" maxlength="4000" placeholder="${composing ? 'Ex.: faz sentido trocar o supino inclinado?' : hasConversation ? 'Responda do seu jeito…' : 'Ex.: semana que vem só tenho 45 minutos por treino'}" ${busy ? 'disabled' : ''}>${esc(draftText ?? draft ?? '')}</textarea></label>
      <button class="btn btn-primary composer-send" type="submit" ${busy ? 'disabled' : ''}>${auth && navigator.onLine ? 'Enviar' : 'Salvar no aparelho'}</button>
      ${waiting && auth ? `<button class="btn" type="button" id="retry-agent" ${busy ? 'disabled' : ''}>Receber resposta do agente</button>` : ''}
      ${latest?.role === 'assistant' && latest.kind === 'summarize' ? `<p class="muted small">Confira o resumo acima. Você pode corrigir algo na conversa antes de continuar.</p><button class="btn" type="button" id="generate-proposal" ${busy || !auth ? 'disabled' : ''}>Resumo correto — gerar proposta</button>` : ''}
    </form>
    ${pendingReviews.map((review) => {
      const plan = plans.find((p) => p.id === review.planId);
      if (!plan) return '';
      const parent = plans.find((p) => p.id === plan.parentId);
      const scheduleChanged = JSON.stringify(parent?.weekdays) !== JSON.stringify(plan.weekdays);
      return `<section class="card proposal-card"><span class="list-label">Proposta · a partir de ${formatDateShort(plan.effectiveFrom)}</span><h2>Sua próxima semana</h2><p>${esc(plan.summary)}</p>
        ${plan.changes.map((c) => `<div class="plan-change"><strong>${esc(plan.days[c.dayKey]?.name)}</strong><p class="muted small">Atual: ${esc(prescription(c.before))}</p><p>Proposto: ${esc(prescription(c.after))}</p><p class="muted small">${esc(c.reason)}</p><details><summary>Registros usados</summary><ul>${c.evidenceIds.map((id) => `<li>${esc(review.evidence?.[id] ?? id)}</li>`).join('')}</ul></details></div>`).join('')}
        ${scheduleChanged ? `<div class="plan-change"><strong>Agenda da semana</strong>${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => `<p class="small">${day}: ${esc(plan.days[plan.weekdays[i]].name)}</p>`).join('')}</div>` : ''}
        ${!plan.changes.length && !scheduleChanged ? '<p class="muted">A proposta mantém a estrutura do seu plano.</p>' : ''}
        <div class="action-row"><button class="btn btn-primary" data-apply="${esc(review.id)}" ${busy || !auth ? 'disabled' : ''}>Aplicar próxima semana</button><button class="btn" data-adjust="${esc(review.conversationId)}">Pedir ajuste</button><button class="btn" data-reject="${esc(review.id)}" ${busy || !auth ? 'disabled' : ''}>Manter plano atual</button></div>
      </section>`;
    }).join('')}
    <details class="card agent-more"><summary>Preferências e histórico</summary>
      <h3>O que o agente sabe sobre mim</h3>
      <p class="muted small">Preferências ficam salvas até você alterar. Para viagens ou restrições temporárias, informe a validade.</p>
      ${memories.map((m) => `<div class="memory-row"><p>${esc(m.text)}</p><span class="muted small">${m.validUntil ? 'Até ' + formatDateShort(m.validUntil) + (m.validUntil < date ? ' · expirada' : '') : 'Preferência duradoura'}</span><div class="action-row"><button class="btn" data-edit-memory="${esc(m.id)}">Editar</button><button class="btn" data-delete-memory="${esc(m.id)}">Excluir</button></div></div>`).join('')}
      <form id="memory-form"><input type="hidden" id="memory-id"><label class="field"><span>Preferência ou informação</span><textarea id="memory-text" maxlength="1500" rows="2" required></textarea></label><label class="field"><span>Válida até (opcional)</span><input id="memory-until" type="date"></label><button class="btn" type="submit">Salvar informação</button></form>
      <h3 class="agent-history-title">Planos anteriores</h3>${plans.filter((p) => p.status === 'applied').sort((a, b) => b.createdAt - a.createdAt).map((p) => `<div class="memory-row"><strong>${p.createdAt ? 'Desde ' + formatDateShort(p.effectiveFrom) : 'Programa inicial'}</strong><p>${esc(p.summary)}</p>${auth ? `<button class="btn" data-restore="${esc(p.id)}" ${busy ? 'disabled' : ''}>Usar como base da próxima semana</button>` : ''}</div>`).join('')}
    </details>`;

  const redraw = () => { if (location.hash === '#/agente') return render(el); };
  const run = async (fn) => {
    if (busy) return;
    busy = true; message = ''; await redraw();
    try { await fn(); } catch (error) { message = error.message; }
    finally { busy = false; await redraw(); }
  };
  const receive = async (convId, userMessageId) => {
    await syncNow();
    await api('converse', { conversationId: convId, messageId: userMessageId, requestId: userMessageId });
    await syncNow();
  };
  const send = async (text, mode = null) => {
    text = text.trim(); if (!text) return;
    let conv = conversation;
    if (!conv || mode) {
      const purpose = mode ?? 'free';
      conv = await putRecord('conversations', { id: newId(), purpose, title: { weekly: 'Revisão da semana', session: 'Feedback do treino', free: 'Conversa' }[purpose], date, createdAt: Date.now() });
      await setLocal('activeConversation', conv.id);
      pendingMode = null;
    }
    const saved = await putRecord('messages', { id: newId(), conversationId: conv.id, role: 'user', text, createdAt: Date.now() });
    draftText = ''; await setLocal('agentDraft', '');
    if (auth && navigator.onLine) await receive(conv.id, saved.id);
    else message = 'Resposta salva no aparelho. Conecte sua conta e toque em Receber resposta do agente.';
  };
  el.querySelector('#agent-form').onsubmit = (event) => { event.preventDefault(); const text = el.querySelector('#agent-text').value; run(() => send(text, pendingMode)); };
  el.querySelector('#agent-text').oninput = (event) => { draftText = event.target.value; setLocal('agentDraft', event.target.value); };
  el.querySelector('#conversation-select')?.addEventListener('change', async (event) => { await setLocal('activeConversation', event.target.value); pendingMode = null; message = ''; await redraw(); });
  el.querySelector('#memory-form').onsubmit = async (event) => {
    event.preventDefault();
    const text = el.querySelector('#memory-text').value.trim(); if (!text) return;
    await putRecord('memories', { id: el.querySelector('#memory-id').value || newId(), text, validFrom: date, validUntil: el.querySelector('#memory-until').value || null, source: 'user', confirmed: true });
    await redraw();
  };
  el.onclick = async (event) => {
    const button = event.target.closest('button'); if (!button || busy) return;
    if (button.dataset.agentConflictId != null) {
      run(async () => {
        await resolveConflict(button.dataset.agentConflictKind, button.dataset.agentConflictId, button.dataset.choice);
        await syncNow();
        const remaining = (await getLocal('syncConflicts')) ?? [];
        if (!remaining.length && waiting) await receive(conversation.id, latest.id);
        else message = remaining.length ? 'Alteração resolvida. Revise a próxima divergência.' : 'Sincronização concluída.';
      });
      return;
    }
    if (button.dataset.start) {
      const mode = button.dataset.start;
      if (mode === 'free') {
        // A conversa nasce no envio: abrir só prepara o campo, sem deixar rascunho vazio no banco.
        pendingMode = 'free'; message = ''; await redraw(); el.querySelector('#agent-text').focus();
      } else { pendingMode = null; run(() => send(mode === 'weekly' ? 'Quero revisar esta semana e preparar a próxima. Faça as perguntas necessárias com base nos meus registros.' : 'Quero conversar sobre meu treino mais recente. Me ajude a registrar o contexto que está faltando.', mode)); }
    }
    if (button.dataset.answer != null) run(() => send(latest.options[Number(button.dataset.answer)]));
    if (button.id === 'retry-agent') run(() => receive(conversation.id, latest.id));
    if (button.id === 'generate-proposal') run(async () => { await syncNow(); await api('propose', { conversationId: conversation.id, summaryId: latest.id, requestId: 'proposal:' + latest.id }); await syncNow(); });
    if (button.dataset.apply) run(async () => { await syncNow(); await api('apply', { reviewId: button.dataset.apply }); await syncNow(); message = 'Próxima semana aplicada. O treino já iniciado mantém sua prescrição.'; });
    if (button.dataset.reject) run(async () => { await api('reject', { reviewId: button.dataset.reject }); await syncNow(); message = 'Plano atual mantido.'; });
    if (button.dataset.adjust) { pendingMode = null; await setLocal('activeConversation', button.dataset.adjust); draftText = 'Quero ajustar a proposta: '; await setLocal('agentDraft', 'Quero ajustar a proposta: '); await redraw(); el.querySelector('#agent-text').focus(); }
    if (button.dataset.deleteMemory) { await removeRecord('memories', button.dataset.deleteMemory); await redraw(); }
    if (button.dataset.editMemory) {
      const m = memories.find((x) => x.id === button.dataset.editMemory);
      el.querySelector('#memory-id').value = m.id; el.querySelector('#memory-text').value = m.text; el.querySelector('#memory-until').value = m.validUntil ?? ''; el.querySelector('#memory-text').focus();
    }
    if (button.dataset.restore) run(async () => {
      await syncNow(); await api('restore', { planId: button.dataset.restore, effectiveFrom: addDaysISO(lastSundayISO(), 7), requestId: newId() }); await syncNow(); message = 'Plano restaurado para a próxima semana. O histórico foi preservado.';
    });
  };
}
