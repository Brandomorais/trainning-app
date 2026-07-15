/*
 * Tela "Treinos" (home): todas as sessões da semana, com a de hoje em
 * destaque e ✓ nas que já tiveram série logada na semana atual (dom-sáb).
 * Tocar num card grava a escolha do dia e abre a sessão.
 */
import { DAYS, WEEKDAYS } from '../program.js';
import { getLogs, getCycle, setCycle, setSelectedSession } from '../db.js';
import { toISODate, lastSundayISO, cycleWeek, formatDateLong } from '../progression.js';

function weekBadge(wk) {
  if (!wk) return '<span class="badge">Ciclo não definido</span>';
  return wk.deload
    ? '<span class="badge badge-deload">DELOAD</span>'
    : `<span class="badge">Semana ${wk.week}/4</span>`;
}

function cardHTML(key, { doneKeys, todayKey }) {
  const day = DAYS[key];
  const meta =
    day.kind === 'lift'
      ? `${day.slots.length} exercícios`
      : day.kind === 'pool'
        ? 'Recuperação ativa'
        : 'Descanso';
  const done = day.kind === 'lift' && doneKeys.has(key);
  return `
    <a class="session-card${key === todayKey ? ' today' : ''}" href="#/treino/${key}" data-key="${key}">
      <div>
        <h2>${day.name}</h2>
        <p class="muted small">${meta}</p>
      </div>
      ${done ? '<span class="done-check" title="Já treinado nesta semana">✓</span>' : ''}
    </a>`;
}

export async function render(el) {
  const date = toISODate();
  const [logs, cycle] = await Promise.all([getLogs(), getCycle()]);
  const wk = cycleWeek(cycle, date);
  const todayKey = WEEKDAYS[new Date().getDay()];

  // Sessões com série logada na semana atual (domingo a sábado).
  const sunday = lastSundayISO();
  const saturday = (() => {
    const d = new Date(`${sunday}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return toISODate(d);
  })();
  const doneKeys = new Set(
    logs.filter((l) => l.date >= sunday && l.date <= saturday).map((l) => l.dayKey)
  );

  const ctx = { doneKeys, todayKey };
  const others = Object.keys(DAYS).filter((k) => k !== todayKey);

  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Treinos</h1>
        <p class="muted small">${formatDateLong(date)}</p>
      </div>
      ${weekBadge(wk)}
    </header>
    ${cycle ? '' : `
      <div class="banner-info">
        Defina o início do ciclo para o app contar as semanas (1-4 + deload).
        <button class="btn btn-primary" id="start-cycle" style="margin-top:10px">Iniciar ciclo — semana 1 começa no último domingo</button>
      </div>`}
    <p class="list-label">★ Hoje</p>
    ${cardHTML(todayKey, ctx)}
    <p class="list-label">Todos os treinos</p>
    ${others.map((k) => cardHTML(k, ctx)).join('')}`;

  el.onclick = async (e) => {
    const card = e.target.closest('.session-card');
    if (card) {
      e.preventDefault();
      // Lembra a escolha até o fim do dia (a data de hoje expira sozinha).
      await setSelectedSession({ date, dayKey: card.dataset.key });
      location.hash = card.getAttribute('href');
      return;
    }
    if (e.target.closest('#start-cycle')) {
      await setCycle({ startDate: lastSundayISO() });
      await render(el);
    }
  };
}
