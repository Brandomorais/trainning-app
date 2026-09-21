import { getLocal, getRecord, setLocal, putRecord, pendingOperations, resolveConflict, wipeAll, KEEP_BOTH_KINDS } from '../db.js';
import { configureConnection, signIn, signOut, api } from '../api.js';
import { syncNow } from '../sync.js';
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function connectionHTML() {
  const [config, auth, profile, pending, lastSync, error, conflicts] = await Promise.all([
    getLocal('connection'), getLocal('auth'), getRecord('profile', 'main'), pendingOperations(), getLocal('lastSync'), getLocal('syncError'), getLocal('syncConflicts'),
  ]);
  // Escolher entre duas versões exige ver as duas.
  const disputed = await Promise.all((conflicts ?? []).map(async (c) => ({ ...c, local: await getRecord(c.kind, c.id) })));
  return `<section class="card"><h2>Agente e sincronização</h2>
    <p class="muted small">Ao conectar, seu histórico, feedback e conversas serão sincronizados. O agente envia o contexto relevante à OpenAI para responder.</p>
    <p class="sync-label">${auth ? 'Conta conectada: ' + esc(auth.user?.email) : 'Conta desconectada'} · ${pending.length} alteração(ões) pendente(s)</p>
    ${lastSync ? `<p class="muted small">Última sincronização: ${new Date(lastSync).toLocaleString('pt-BR')}</p>` : ''}
    ${error ? `<p class="agent-notice">${esc(error)}</p>` : ''}
    <div id="connection-status" role="status"></div>
    ${auth ? '<div class="action-row"><button class="btn btn-primary" id="sync-now">Sincronizar agora</button><button class="btn" id="sign-out">Sair da conta</button></div>' : `<details ${!config ? 'open' : ''}><summary>Configurar conexão</summary><label class="field"><span>URL do projeto Supabase</span><input id="remote-url" type="url" value="${esc(config?.url)}" placeholder="https://seu-projeto.supabase.co"></label><label class="field"><span>Chave pública (publishable ou anon)</span><input id="remote-public-key" value="${esc(config?.publicKey)}" autocomplete="off"></label><button class="btn" id="save-connection">Salvar conexão</button></details>
      <label class="field"><span>E-mail da conta</span><input id="account-email" type="email" autocomplete="username"></label><label class="field"><span>Senha</span><input id="account-password" type="password" autocomplete="current-password"></label><button class="btn btn-primary" id="sign-in">Entrar e sincronizar</button>`}
    ${disputed.map((c) => `<div class="conflict"><strong>Alteração em ${esc(c.kind)}</strong><p class="small">Existe outra versão deste registro no servidor.</p><details><summary>Comparar as duas versões</summary><p class="small">Deste aparelho</p><pre>${esc(c.local ? JSON.stringify(c.local, null, 2) : 'Registro apagado neste aparelho.')}</pre><p class="small">Do servidor</p><pre>${esc(c.deleted ? 'Registro apagado no servidor.' : JSON.stringify(c.value, null, 2))}</pre></details><div class="action-row"><button class="btn" data-conflict-kind="${esc(c.kind)}" data-conflict-id="${esc(c.id)}" data-choice="local">Manter deste aparelho</button><button class="btn" data-conflict-kind="${esc(c.kind)}" data-conflict-id="${esc(c.id)}" data-choice="remote">Usar do servidor</button>${KEEP_BOTH_KINDS.has(c.kind) && c.local && !c.deleted ? `<button class="btn btn-primary" data-conflict-kind="${esc(c.kind)}" data-conflict-id="${esc(c.id)}" data-choice="both">Preservar as duas</button>` : ''}</div></div>`).join('')}
  </section>
  <section class="card"><h2>Seu contexto</h2>
    <label class="field"><span>Objetivo e equipamentos disponíveis</span><textarea id="profile-context" rows="3" maxlength="2000">${esc(profile?.context)}</textarea></label>
    <label class="field"><span>Tempo disponível por treino (minutos)</span><input id="profile-duration" type="number" min="15" max="180" value="${profile?.durationMinutes ?? 60}"></label>
    <label class="field"><span>Dias e horários habituais</span><input id="profile-days" maxlength="300" value="${esc(profile?.availability)}" placeholder="Ex.: domingo, segunda, quarta e sexta"></label>
    <label class="setting-check"><input type="checkbox" id="schedule-enabled" ${profile?.scheduleEnabled ? 'checked' : ''}>Preparar revisão semanal automaticamente</label>
    <div class="action-row"><label class="field"><span>Dia</span><select id="schedule-day">${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, i) => `<option value="${i}"${(profile?.scheduleDay ?? 6) === i ? ' selected' : ''}>${day}</option>`).join('')}</select></label><label class="field"><span>Hora (São Paulo)</span><input id="schedule-hour" type="number" min="0" max="23" value="${profile?.scheduleHour ?? 18}"></label></div>
    <p class="muted small">A preparação automática depende da conexão e do agendamento configurado no servidor. Ela usa apenas os registros já sincronizados.</p>
    <button class="btn" id="save-profile">Salvar contexto</button>
    ${auth ? '<details><summary>Excluir dados remotos</summary><p class="muted small">Remove registros, conversas e planos da nuvem e deste aparelho. Exporte um backup primeiro.</p><button class="btn btn-danger" id="erase-remote">Excluir dados da nuvem e deste aparelho</button></details>' : ''}
  </section>`;
}
export async function handleConnectionClick(event, el, redraw) {
  const button = event.target.closest('button');
  if (!button || !['save-connection', 'sign-in', 'sign-out', 'sync-now', 'save-profile', 'erase-remote'].includes(button.id) && button.dataset.conflictId == null) return false;
  button.disabled = true;
  try {
    if (button.id === 'save-connection') { await configureConnection(el.querySelector('#remote-url').value.trim(), el.querySelector('#remote-public-key').value.trim()); }
    if (button.id === 'sign-in') {
      if (el.querySelector('#remote-url')?.value) await configureConnection(el.querySelector('#remote-url').value.trim(), el.querySelector('#remote-public-key').value.trim());
      await signIn(el.querySelector('#account-email').value.trim(), el.querySelector('#account-password').value);
      el.querySelector('#account-password').value = '';
      await syncNow();
    }
    if (button.id === 'sign-out') await signOut();
    if (button.id === 'sync-now') await syncNow();
    if (button.id === 'save-profile') {
      const durationMinutes = Number(el.querySelector('#profile-duration').value);
      const scheduleDay = Number(el.querySelector('#schedule-day').value);
      const scheduleHour = Number(el.querySelector('#schedule-hour').value);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180 || !Number.isInteger(scheduleHour) || scheduleHour < 0 || scheduleHour > 23) throw new Error('Confira a duração e o horário.');
      await putRecord('profile', { id: 'main', context: el.querySelector('#profile-context').value.trim(), availability: el.querySelector('#profile-days').value.trim(), durationMinutes, scheduleEnabled: el.querySelector('#schedule-enabled').checked, scheduleDay, scheduleHour, timezone: 'America/Sao_Paulo' });
    }
    if (button.dataset.conflictId != null) {
      // Endereçar por kind+id: a sincronização de fundo reescreve a lista e um índice apontaria para outro registro.
      await resolveConflict(button.dataset.conflictKind, button.dataset.conflictId, button.dataset.choice);
      await syncNow();
    }
    if (button.id === 'erase-remote') {
      if (!confirm('Excluir os dados da nuvem e deste aparelho? Essa ação não pode ser desfeita sem backup.')) return true;
      await api('erase', { confirmation: 'EXCLUIR' });
      await wipeAll();
    }
    await redraw();
    el.querySelector('#connection-status').textContent = 'Salvo.';
  } catch (error) {
    await redraw().catch(() => {});
    // O erro de sincronização já aparece no aviso persistido acima; não repetir na linha de status.
    if (error.message !== await getLocal('syncError')) el.querySelector('#connection-status').textContent = error.message;
  }
  finally { button.disabled = false; }
  return true;
}
