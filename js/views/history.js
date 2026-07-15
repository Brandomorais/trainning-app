/*
 * Histórico por exercício: gráfico de e1RM (Epley) por sessão + lista de séries.
 */
import { EXERCISES } from '../program.js';
import { getLogs } from '../db.js';
import {
  sessionsFor,
  bestE1RM,
  epley,
  fmtKg,
  formatDateShort,
  formatDateLong,
} from '../progression.js';
import { renderLineChart } from '../components/chart.js';

let selectedEx = null;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export async function render(el) {
  const logs = await getLogs();
  const ids = Object.keys(EXERCISES).filter((id) => logs.some((l) => l.exerciseId === id));

  if (!ids.length) {
    el.innerHTML = `
      <header class="page-head"><h1>Histórico</h1></header>
      <div class="empty-state">Nenhuma série registrada ainda.<br>Registre o treino de hoje e a progressão aparece aqui. 🏋️</div>`;
    return;
  }

  if (!ids.includes(selectedEx)) selectedEx = ids[0];
  const sessions = sessionsFor(logs, selectedEx);

  const points = sessions.map((s) => ({
    label: formatDateShort(s.date),
    value: Math.round(bestE1RM(s.sets) * 10) / 10,
    deload: s.sets.some((x) => x.isDeload),
  }));

  const bestOverall = Math.max(...points.map((p) => p.value));
  const maxWeight = Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.weight)));
  const lastPoint = points[points.length - 1];

  const options = ids
    .map((id) => `<option value="${id}"${id === selectedEx ? ' selected' : ''}>${EXERCISES[id].name}</option>`)
    .join('');

  const sessionList = [...sessions]
    .reverse()
    .map((s) => {
      const isDeload = s.sets.some((x) => x.isDeload);
      const rows = s.sets
        .map((x) => {
          const label = `${x.weight === 0 ? 'PC' : fmt1(x.weight)} × ${x.reps}${x.rpe ? ` @RPE${x.rpe}` : ''}`;
          const e = x.weight > 0 ? `<span class="e1rm">e1RM ${fmt1(epley(x.weight, x.reps))}</span>` : '';
          const note = x.notes ? `<span class="note">${esc(x.notes)}</span>` : '';
          return `<li><span>${label}</span>${note || e}</li>`;
        })
        .join('');
      return `
        <div class="session">
          <h3>${formatDateLong(s.date)}${isDeload ? '<span class="tag-deload">DELOAD</span>' : ''}</h3>
          <ul>${rows}</ul>
        </div>`;
    })
    .join('');

  el.innerHTML = `
    <header class="page-head"><h1>Histórico</h1></header>
    <label class="field">
      <span>Exercício</span>
      <select id="ex-select">${options}</select>
    </label>
    <div class="stat-row">
      <div class="stat">Melhor e1RM<b>${fmt1(bestOverall)} kg</b></div>
      <div class="stat">Maior carga<b>${fmtKg(maxWeight)}</b></div>
      <div class="stat">Sessões<b>${sessions.length}</b></div>
    </div>
    <section class="card chart-card">
      <h2>e1RM por sessão — ${EXERCISES[selectedEx].name}</h2>
      <p class="chart-sub">Epley: carga × (1 + reps/30) · melhor série do dia · ○ = deload</p>
      <div class="chart-wrap"></div>
    </section>
    ${sessionList}`;

  renderLineChart(el.querySelector('.chart-wrap'), points);

  el.onchange = async (e) => {
    if (e.target.id === 'ex-select') {
      selectedEx = e.target.value;
      await render(el);
    }
  };
}
