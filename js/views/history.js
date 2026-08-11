/*
 * Histórico: Resumo (PRs SBD + frequência semanal) e, por exercício ou
 * modalidade aeróbica, gráficos + lista de sessões.
 */
import { EXERCISES, DAYS, CARDIO_MODALITIES } from '../program.js';
import { getLogs, getCardio, getSettings, getExerciseNotes } from '../db.js';
import {
  sessionsFor,
  sessionsByDay,
  bestE1RM,
  epley,
  fmtWeight,
  displayWeight,
  formatDateShort,
  formatDateLong,
  formatTime,
  paceFor,
  lastSundayISO,
  bestPR,
  weeklyLiftCounts,
  analyzeTrend,
  trendSignals,
} from '../progression.js';
import { renderLineChart, renderBarChart } from '../components/chart.js';

let selectedEx = null;

/* Lista de sessões paginada: a página inteira era grande demais para achar
 * qualquer coisa. Volta ao início sempre que o exercício muda. */
const LIST_PAGE = 5;
let expandedList = false;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/* ---------- Resumo (força) ---------- */
const SBD = ['agacho', 'supino', 'terra'];

function resumoHTML(logs) {
  const sunday = lastSundayISO();
  const prs = SBD.map((id) => ({ name: EXERCISES[id].name, pr: bestPR(logs, id) }));
  const total = prs.every((p) => p.pr) ? prs.reduce((s, p) => s + p.pr.e1rm, 0) : null;
  const missing = prs.filter((p) => !p.pr).map((p) => p.name);

  const tiles = prs
    .map(({ name, pr }) => {
      if (!pr) return `<div class="stat">${name}<b>—</b><span class="pr-sub">sem registro</span></div>`;
      const isNew = pr.date >= sunday;
      return `<div class="stat">${name}${isNew ? ' 🏆' : ''}<b>${fmt1(pr.e1rm)}</b>
        <span class="pr-sub">${fmt1(pr.weight)}×${pr.reps} · ${formatDateShort(pr.date)}</span></div>`;
    })
    .join('');

  const liftDayCount = Object.values(DAYS).filter((d) => d.kind === 'lift').length;
  const doneThisWeek = new Set(
    logs.filter((l) => l.date >= sunday).map((l) => `${l.date}|${l.dayKey}`)
  ).size;
  const squares =
    '■'.repeat(Math.min(doneThisWeek, liftDayCount)) +
    '□'.repeat(Math.max(0, liftDayCount - doneThisWeek));

  return `
    <p class="list-label">Resumo</p>
    <div class="stat-row">${tiles}</div>
    <section class="card total-card">
      <span>Total powerlifting <span class="muted small">(e1RM AG+SU+TE)</span></span>
      <b>${total ? `${fmt1(total)} kg` : '—'}</b>
      ${missing.length ? `<p class="muted small" style="margin-top:4px">Falta registrar: ${missing.join(', ')}.</p>` : ''}
    </section>
    <section class="card chart-card">
      <h2>Treinos de barra por semana</h2>
      <p class="chart-sub">Esta semana: ${squares} ${doneThisWeek}/${liftDayCount} · últimas 12 semanas · ▢ = deload</p>
      <div class="chart-wrap" id="weekly-chart"></div>
    </section>`;
}

/* ---------- Detalhe de exercício de força ---------- */
/* Dados são kg; `unit` = lente de exibição do exercício (máquinas em lb). */
function strengthDetail(logs, unit, exNotes) {
  const sessions = sessionsFor(logs, selectedEx);

  // Uma série por prescrição: agacho pesado (Barra A) e volume (Barra C) são
  // progressões diferentes e não podem dividir a mesma linha.
  const groups = sessionsByDay(logs, selectedEx);
  const series = groups.map((g) => ({
    // Só "Barra C", não "Barra C — Supino pesado": o nome cheio do dia cita o
    // levantamento-título dele, que num gráfico de agacho seria ruído.
    name: g.slot ? `${curtoDia(g.name)} · ${prescricaoCurta(g.slot)}` : curtoDia(g.name),
    points: g.sessions.map((s) => ({
      x: s.date,
      label: formatDateShort(s.date),
      value: Math.round(displayWeight(bestE1RM(s.sets), unit) * 10) / 10,
      deload: s.sets.some((x) => x.isDeload),
    })),
  }));

  const bestOverall = Math.max(...series.flatMap((s) => s.points.map((p) => p.value)));
  const maxWeight = Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.weight)));

  // Tendência por prescrição (só levantamentos principais): agacho pesado
  // (Barra A) e agacho volume (Barra C) são analisados separadamente.
  let trendHTML = '';
  if (EXERCISES[selectedEx].type === 'main') {
    trendHTML = Object.entries(DAYS)
      .filter(([, day]) => day.kind === 'lift')
      .flatMap(([dayKey, day]) => {
        const slot = (day.slots ?? []).find((s) => s.exerciseId === selectedEx);
        if (!slot || !logs.some((l) => l.exerciseId === selectedEx && l.dayKey === dayKey)) return [];
        const t = analyzeTrend(slot, logs, dayKey);
        if (t.insufficient) {
          return [`<div class="trend"><b>${day.name}</b> — análise de tendência a partir de 3 sessões (tem ${t.sessions}).</div>`];
        }
        const head = { ok: '✓ Progredindo', atencao: '⚠ Atenção', estagnado: '⛔ Estagnado' }[t.status];
        const why =
          t.status === 'ok'
            ? 'e1RM subindo na janela recente'
            : trendSignals(t, slot).join(' e ');
        const tail = t.status === 'estagnado' ? '. Considere deload antecipado (−10%)' : '';
        return [`<div class="trend trend-${t.status}"><b>${head}</b> — ${day.name}: ${why}${tail}.</div>`];
      })
      .join('');
  }

  const ordered = [...sessions].reverse();
  const shown = expandedList ? ordered : ordered.slice(0, LIST_PAGE);
  const rest = ordered.length - shown.length;

  const sessionList = shown
    .map((s) => {
      const isDeload = s.sets.some((x) => x.isDeload);
      const dayNote = exNotes
        .filter((n) => n.date === s.date && n.exerciseId === selectedEx)
        .map((n) => n.text)
        .join(' · ');
      const rows = s.sets
        .map((x) => {
          const label = `${x.weight === 0 ? 'PC' : fmt1(displayWeight(x.weight, unit))} × ${x.reps}${x.rpe ? ` @RPE${x.rpe}` : ''}`;
          const e = x.weight > 0 ? `<span class="e1rm">e1RM ${fmt1(displayWeight(epley(x.weight, x.reps), unit))}</span>` : '';
          const note = x.notes ? `<span class="note">${esc(x.notes)}</span>` : '';
          return `<li><span>${label}</span>${note || e}</li>`;
        })
        .join('');
      return `
        <div class="session">
          <h3>${formatDateLong(s.date)}${isDeload ? '<span class="tag-deload">DELOAD</span>' : ''}</h3>
          ${dayNote ? `<p class="session-note">${esc(dayNote)}</p>` : ''}
          <ul>${rows}</ul>
        </div>`;
    })
    .join('');

  const html = `
    <div class="stat-row">
      <div class="stat">Melhor e1RM<b>${fmt1(bestOverall)} ${unit}</b><span class="pr-sub">estimativa</span></div>
      <div class="stat">Maior carga<b>${fmtWeight(maxWeight, unit)}</b><span class="pr-sub">peso real na barra</span></div>
      <div class="stat">Sessões<b>${sessions.length}</b><span class="pr-sub">com registro</span></div>
    </div>
    ${trendHTML}
    <section class="card chart-card">
      <h2>e1RM por sessão — ${EXERCISES[selectedEx].name}</h2>
      <p class="chart-sub">Força estimada para 1 repetição, a partir da melhor série do dia — é o que
        permite comparar dias de reps diferentes. Em ${unit} · ○ = deload.</p>
      <div class="chart-wrap" id="detail-chart"></div>
    </section>
    ${e1rmHelpHTML(series.length)}
    <p class="list-label">Sessões</p>
    ${sessionList}
    ${rest ? `<button class="btn btn-more" id="list-more">Ver mais (${rest} restante${rest === 1 ? '' : 's'})</button>` : ''}`;

  return { html, mount: (el) => renderLineChart(el.querySelector('#detail-chart'), series) };
}

/* Prescrição em forma curta para rotular a série: "4x4 @8". */
function prescricaoCurta(slot) {
  return `${slot.sets}x${slot.reps ?? ''}${slot.rpe ? ` @${slot.rpe}` : ''}`;
}

/* "Barra C — Supino pesado" → "Barra C". */
const curtoDia = (name) => name.split('—')[0].trim();

/*
 * O e1RM é o número que manda na tela toda e nunca era explicado — só a
 * fórmula aparecia. Fica recolhido para não pesar em quem já sabe.
 */
function e1rmHelpHTML(seriesCount) {
  return `
    <details class="warmup card helper">
      <summary>O que é e1RM?</summary>
      <p><b>e1RM</b> é a carga estimada para uma única repetição máxima — uma
      <em>estimativa</em> calculada, não um teste feito. Serve para comparar
      sessões de prescrições diferentes: 75×4 e 65×6 viram números na mesma
      régua.</p>
      <p>A conta é a fórmula de Epley: <code>carga × (1 + reps/30)</code>,
      sempre pela melhor série do dia. Ela perde precisão acima de ~10 reps,
      então em acessório leve leia como tendência, não como número exato.</p>
      <p><b>Melhor e1RM</b> é estimado; <b>maior carga</b> é o peso que
      realmente esteve na barra. Marcador vazado (○) é semana de deload — carga
      baixa de propósito, não queda de desempenho.</p>
      ${
        seriesCount > 1
          ? `<p>As linhas são separadas por prescrição: o mesmo exercício pesado
             e em volume progride em ritmos diferentes, e somar os dois numa
             linha só faz progresso limpo parecer instabilidade.</p>`
          : ''
      }
    </details>`;
}

/* ---------- Detalhe de modalidade aeróbica ---------- */
const paceLabel = (mod) => (mod.paceRef === 1000 ? 'min/km' : `min/${mod.paceRef}m`);
const fmtDist = (meters, mod) =>
  mod.unit === 'km'
    ? `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
    : `${meters.toLocaleString('pt-BR')} m`;

function cardioDetail(cardio, modality) {
  const mod = CARDIO_MODALITIES[modality];

  // Uma "sessão" = um dia (registros do mesmo dia somam distância e tempo).
  const byDate = new Map();
  for (const c of cardio) {
    if (c.modality !== modality) continue;
    const cur = byDate.get(c.date) ?? { date: c.date, meters: 0, seconds: 0, notes: [] };
    cur.meters += c.meters;
    cur.seconds += c.seconds;
    if (c.notes) cur.notes.push(c.notes);
    byDate.set(c.date, cur);
  }
  const sessions = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  const withPace = sessions.map((s) => ({ ...s, pace: paceFor(s.meters, s.seconds, mod.paceRef) }));
  const bestPace = Math.min(...withPace.map((s) => s.pace));
  const maxDist = Math.max(...sessions.map((s) => s.meters));

  const pacePoints = withPace.map((s) => ({
    label: formatDateShort(s.date),
    value: Math.round(s.pace),
  }));
  const distPoints = sessions.map((s) => ({
    label: formatDateShort(s.date),
    value: mod.unit === 'km' ? Math.round(s.meters / 10) / 100 : s.meters,
  }));

  const sessionList = [...withPace]
    .reverse()
    .map(
      (s) => `
      <div class="session">
        <h3>${formatDateLong(s.date)}</h3>
        <ul>
          <li><span>${fmtDist(s.meters, mod)} · ${formatTime(s.seconds)}</span>
            <span class="e1rm">${formatTime(s.pace)} ${paceLabel(mod)}</span></li>
          ${s.notes.map((n) => `<li><span class="note">${esc(n)}</span></li>`).join('')}
        </ul>
      </div>`
    )
    .join('');

  const html = `
    <div class="stat-row">
      <div class="stat">Melhor pace<b>${formatTime(bestPace)}</b><span class="pr-sub">${paceLabel(mod)}</span></div>
      <div class="stat">Maior distância<b>${fmtDist(maxDist, mod)}</b></div>
      <div class="stat">Sessões<b>${sessions.length}</b></div>
    </div>
    <section class="card chart-card">
      <h2>Pace por sessão — ${mod.name}</h2>
      <p class="chart-sub">${paceLabel(mod)} · menor é melhor</p>
      <div class="chart-wrap" id="pace-chart"></div>
    </section>
    <section class="card chart-card">
      <h2>Distância por sessão — ${mod.name}</h2>
      <p class="chart-sub">${mod.unit === 'km' ? 'quilômetros' : 'metros'} por dia</p>
      <div class="chart-wrap" id="dist-chart"></div>
    </section>
    ${sessionList}`;

  const mount = (el) => {
    renderLineChart(el.querySelector('#pace-chart'), pacePoints, {
      fmtValue: (v) => `${formatTime(v)} ${paceLabel(mod)}`,
      fmtTick: (t) => formatTime(t),
      ariaLabel: `Pace de ${mod.name}`,
    });
    renderLineChart(el.querySelector('#dist-chart'), distPoints, {
      fmtValue: (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${mod.unit}`,
      ariaLabel: `Distância de ${mod.name}`,
    });
  };

  return { html, mount };
}

/* ---------- Tela ---------- */
export async function render(el) {
  const [logs, cardio, settings, exNotes] = await Promise.all([
    getLogs(),
    getCardio(),
    getSettings(),
    getExerciseNotes(),
  ]);
  const units = settings.units ?? {};

  const strengthIds = Object.keys(EXERCISES).filter((id) => logs.some((l) => l.exerciseId === id));
  const cardioIds = Object.keys(CARDIO_MODALITIES)
    .filter((m) => cardio.some((c) => c.modality === m))
    .map((m) => `cardio:${m}`);
  const all = [...strengthIds, ...cardioIds];

  if (!all.length) {
    el.innerHTML = `
      <header class="page-head"><h1>Histórico</h1></header>
      <div class="empty-state">Nenhum registro ainda.<br>Registre um treino de barra ou aeróbico e a progressão aparece aqui. 🏋️</div>`;
    return;
  }

  if (!all.includes(selectedEx)) {
    selectedEx = all[0];
    expandedList = false;
  }

  const options = [
    ...strengthIds.map(
      (id) => `<option value="${id}"${id === selectedEx ? ' selected' : ''}>${EXERCISES[id].name}</option>`
    ),
    ...cardioIds.map((v) => {
      const m = CARDIO_MODALITIES[v.slice('cardio:'.length)];
      return `<option value="${v}"${v === selectedEx ? ' selected' : ''}>${m.name} (aeróbico)</option>`;
    }),
  ].join('');

  const detail = selectedEx.startsWith('cardio:')
    ? cardioDetail(cardio, selectedEx.slice('cardio:'.length))
    : strengthDetail(logs, units[selectedEx] ?? 'kg', exNotes);

  el.innerHTML = `
    <header class="page-head"><h1>Histórico</h1></header>
    ${logs.length ? resumoHTML(logs) : ''}
    <p class="list-label">Por exercício</p>
    <label class="field">
      <span>Exercício</span>
      <select id="ex-select">${options}</select>
    </label>
    ${detail.html}`;

  if (logs.length) {
    renderBarChart(el.querySelector('#weekly-chart'), weeklyLiftCounts(logs), {
      fmtValue: (v) => `${v} treino${v === 1 ? '' : 's'} de barra`,
      ariaLabel: 'Treinos de barra por semana',
    });
  }
  detail.mount(el);

  el.onchange = async (e) => {
    if (e.target.id === 'ex-select') {
      selectedEx = e.target.value;
      expandedList = false;
      await render(el);
    }
  };

  el.onclick = async (e) => {
    if (e.target.closest('#list-more')) {
      expandedList = true;
      await render(el);
    }
  };
}
