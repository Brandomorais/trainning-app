/*
 * Bootstrap: roteador por hash + registro do service worker.
 * Na abertura, se há um treino escolhido hoje, cai direto nele.
 */
import * as sessions from './views/sessions.js';
import * as session from './views/session.js';
import * as historyView from './views/history.js';
import * as settings from './views/settings.js';
import { DAYS } from './program.js';
import { getSelectedSession } from './db.js';
import { toISODate } from './progression.js';

const view = document.getElementById('view');

function resolve(hash) {
  const m = hash.match(/^#\/treino\/([\w-]+)$/);
  if (m && DAYS[m[1]]) {
    return { render: (el) => session.render(el, m[1]), tab: '#/treinos' };
  }
  const table = {
    '#/treinos': sessions.render,
    '#/historico': historyView.render,
    '#/config': settings.render,
  };
  if (table[hash]) return { render: table[hash], tab: hash };
  return { render: sessions.render, tab: '#/treinos' };
}

async function navigate() {
  const { render, tab } = resolve(location.hash);
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === tab);
  });
  view.onclick = null;
  view.onchange = null;
  await render(view);
  window.scrollTo(0, 0);
}

async function start() {
  // Escolha manual do dia vale até a data virar; PWA abre sempre sem hash.
  if (!location.hash || location.hash === '#/hoje') {
    try {
      const sel = await getSelectedSession();
      if (sel && sel.date === toISODate() && DAYS[sel.dayKey]) {
        history.replaceState(null, '', `#/treino/${sel.dayKey}`);
      }
    } catch {
      /* banco indisponível: segue para a lista */
    }
  }
  window.addEventListener('hashchange', navigate);
  await navigate();
}

start();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sem SW (ex.: http em rede local) o app ainda funciona, só não offline */
    });
  });
}
