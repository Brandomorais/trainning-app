/*
 * Tela "Treinos" (home): todas as sessões da semana, com a de hoje em
 * destaque e ✓ nas que já tiveram série logada na semana atual (dom-sáb).
 * Tocar num card grava a escolha do dia e abre a sessão.
 */
import { DAYS, WEEKDAYS } from '../program.js';
import { getLogs, getCardio, getCycle, setCycle, setSelectedSession } from '../db.js';
import {
  toISODate,
  lastSundayISO,
  cycleWeek,
  deloadAdvice,
  formatDateLong,
  formatDateShort,
} from '../progression.js';

function weekBadge(wk) {
  if (!wk) return '<span class="badge">Ciclo não definido</span>';
  if (wk.deload) return '<span class="badge badge-deload">DELOAD</span>';
  if (wk.delayed) return `<span class="badge">Semana ${wk.week} — deload adiado</span>`;
  return `<span class="badge">Semana ${wk.week}/4</span>`;
}

/* Banner do deload híbrido: antecipar (fadiga) ou adiar (semana 5 limpa). */
function deloadBannerHTML(advice) {
  if (!advice) return '';
  if (advice.type === 'antecipar') {
    return `
      <div class="banner-info">
        Fadiga acumulada: ${advice.signals.join(' · ')}. A literatura recomenda deload dentro da janela de 4-6 semanas.
        <button class="btn btn-primary" id="deload-now" data-start="${advice.deloadStart}" style="margin-top:10px">Antecipar deload (7 dias a partir de hoje)</button>
      </div>`;
  }
  return `
    <div class="banner-info">
      Semana de deload, mas sem sinais de fadiga nos básicos — dá para adiar 1 semana (teto: 6ª).
      <button class="btn" id="deload-delay" data-start="${advice.deloadStart}" style="margin-top:10px">Adiar deload para ${formatDateShort(advice.deloadStart)}</button>
    </div>`;
}

function cardHTML(key, { doneKeys, todayKey, deload }) {
  const day = DAYS[key];
  const skipped = deload && Boolean(day.skipOnDeload);
  const meta = skipped
    ? 'Fora da semana de deload'
    : day.kind === 'lift'
      ? `${day.slots.length} exercícios`
      : day.kind === 'cardio'
        ? 'Distância + tempo · pace automático'
        : 'Descanso';
  const done = day.kind !== 'off' && !skipped && doneKeys.has(key);
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
  const [logs, cardio, cycle] = await Promise.all([getLogs(), getCardio(), getCycle()]);
  const wk = cycleWeek(cycle, date);
  const todayKey = WEEKDAYS[new Date().getDay()];

  // Sessões com registro na semana atual (domingo a sábado).
  const sunday = lastSundayISO();
  const saturday = (() => {
    const d = new Date(`${sunday}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return toISODate(d);
  })();
  const inWeek = (x) => x.date >= sunday && x.date <= saturday;
  const doneKeys = new Set(logs.filter(inWeek).map((l) => l.dayKey));
  if (cardio.some(inWeek)) doneKeys.add('aerobico');

  const ctx = { doneKeys, todayKey, deload: wk?.deload ?? false };
  const others = Object.keys(DAYS).filter((k) => k !== todayKey);
  const advice = cycle ? deloadAdvice(logs, cycle, date) : null;

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
    ${deloadBannerHTML(advice)}
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
      return;
    }
    // Deload híbrido: antecipar/adiar gravam deloadStart no ciclo.
    const deloadBtn = e.target.closest('#deload-now, #deload-delay');
    if (deloadBtn) {
      await setCycle({ ...cycle, deloadStart: deloadBtn.dataset.start });
      await render(el);
    }
  };
}
