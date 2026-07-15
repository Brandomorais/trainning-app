/*
 * Tela de sessão de treino (rota #/treino/<dayKey>): aquecimento,
 * mobilidade e exercícios, logando cada série com prescrição pré-preenchida.
 */
import {
  DAYS,
  EXERCISES,
  FIXED_WARMUP,
  GENERAL_WARMUP,
  RAMP_HINT,
  MOBILITY_NOTE,
  RPE_SCALE,
  youtubeURL,
} from '../program.js';
import { getLogs, addLog, deleteLog, getCycle } from '../db.js';
import { toISODate, formatDateLong, cycleWeek, advise } from '../progression.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const parseNum = (v) => {
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function weekBadge(wk) {
  if (!wk) return '<span class="badge">Ciclo não definido</span>';
  return wk.deload
    ? '<span class="badge badge-deload">DELOAD</span>'
    : `<span class="badge">Semana ${wk.week}/4</span>`;
}

const videoRow = (item, cls = '') =>
  `<li class="${cls}"><a class="video-link" href="${youtubeURL(item)}" target="_blank" rel="noopener">
    <span>${esc(item.name)}</span><span class="play" aria-label="Ver vídeo no YouTube">▶</span></a></li>`;

function warmupHTML(day) {
  const items = [];
  if (day.generalWarmup) items.push(`<li>${GENERAL_WARMUP}</li>`);
  for (const m of day.mobility ?? []) items.push(videoRow(m));
  items.push(videoRow(FIXED_WARMUP, 'fixed'));
  if ((day.slots ?? []).some((s) => s.ramp)) items.push(`<li class="ramp">${RAMP_HINT}</li>`);
  return `
    <details class="warmup card" open>
      <summary>Aquecimento &amp; mobilidade</summary>
      <p class="muted small">${MOBILITY_NOTE}</p>
      <ul>${items.join('')}</ul>
    </details>`;
}

function rpeRefHTML() {
  const parts = RPE_SCALE.map((r) => `<b>${r.rpe}</b> ${r.hint}`).join(' · ');
  return `<p class="rpe-ref">RPE: ${parts}</p>`;
}

function setChips(todaysSets) {
  if (!todaysSets.length) return '';
  const chips = todaysSets
    .map(
      (s) => `<span class="set-chip">S${s.setNumber} · ${s.weight === 0 ? 'PC' : s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}
        <button class="del-set" data-id="${s.id}" aria-label="Apagar série">✕</button></span>`
    )
    .join('');
  return `<div class="done-sets">${chips}</div>`;
}

function slotCard(slot, ctx) {
  const ex = EXERCISES[slot.exerciseId];
  const todays = ctx.logs
    .filter((l) => l.date === ctx.date && l.exerciseId === slot.exerciseId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const effSets = ctx.deload ? Math.max(1, Math.ceil(slot.sets / 2)) : slot.sets;
  const adv = advise(slot, ctx.logs, ctx.date, ctx.deload);
  const lastToday = todays[todays.length - 1];
  const prefWeight = lastToday ? lastToday.weight : adv.weight ?? '';
  const prefReps = slot.reps ?? 10;
  const done = todays.length >= effSets;

  const prescription =
    `${effSets}x${slot.reps ?? ''}` +
    (slot.rpe && !ctx.deload ? ` @RPE${slot.rpe}` : '') +
    (slot.note ? ` (${slot.note})` : '');

  const targetRpe = ctx.deload ? null : slot.rpe;
  const rpeButtons = [6, 7, 8, 9, 10]
    .map(
      (v) =>
        `<button class="rpe-btn${v === targetRpe ? ' target' : ''}" data-rpe="${v}">${v}</button>`
    )
    .join('');

  return `
    <section class="card exercise" data-ex="${slot.exerciseId}">
      <div class="ex-head">
        <h2>${ex.name}
          <a class="video-link-inline" href="${youtubeURL(ex)}" target="_blank" rel="noopener" aria-label="Ver técnica no YouTube">▶</a>
          ${done ? '<span class="done-mark">✓</span>' : ''}</h2>
        <span class="prescription">${prescription}</span>
      </div>
      <p class="muted small ex-meta">Descanso ${slot.rest}${slot.ramp ? ' · rampa antes da 1ª série' : ''}</p>
      <p class="hint">${adv.text}</p>
      ${setChips(todays)}
      <label class="field-label">Carga (kg)</label>
      <div class="stepper">
        <button class="step-btn" data-delta="-2.5" aria-label="Menos 2,5 kg">−</button>
        <input class="in-weight" type="text" inputmode="decimal" value="${prefWeight}" placeholder="kg">
        <button class="step-btn" data-delta="2.5" aria-label="Mais 2,5 kg">+</button>
      </div>
      <label class="field-label">Reps</label>
      <div class="stepper">
        <button class="step-btn" data-delta="-1" aria-label="Menos 1 rep">−</button>
        <input class="in-reps" type="text" inputmode="numeric" value="${prefReps}">
        <button class="step-btn" data-delta="1" aria-label="Mais 1 rep">+</button>
      </div>
      <label class="field-label">RPE ${targetRpe ? `(alvo ${targetRpe})` : '(opcional)'}</label>
      <div class="rpe-row">${rpeButtons}<button class="rpe-btn" data-rpe="">—</button></div>
      <input class="notes-input" type="text" placeholder="Notas (opcional)" maxlength="200">
      <button class="log-btn">${done ? 'Registrar série extra' : `Registrar série ${todays.length + 1}/${effSets}`}</button>
    </section>`;
}

/*
 * `logDate` permite registro retroativo: tudo na tela (chips, sugestões,
 * deload e as séries gravadas) passa a valer para essa data. Só vive
 * através dos rerenders — navegar para fora e voltar reseta para hoje.
 */
export async function render(el, dayKey, logDate) {
  const day = DAYS[dayKey];
  if (!day) {
    location.hash = '#/treinos';
    return;
  }

  const today = toISODate();
  const date = logDate && logDate <= today ? logDate : today;
  const [logs, cycle] = await Promise.all([getLogs(), getCycle()]);
  const wk = cycleWeek(cycle, date);
  const deload = wk?.deload ?? false;
  const ctx = { logs, date, deload, dayKey };

  let body = '';
  if (day.kind === 'lift') {
    body = `
      ${deload ? '<div class="banner-deload">Semana de deload: ~60% da carga, metade das séries, sem RPE alto. As prescrições abaixo já estão ajustadas.</div>' : ''}
      ${day.noPR ? '<div class="banner-info">Dia leve — não buscar PR.</div>' : ''}
      ${warmupHTML(day)}
      ${rpeRefHTML()}
      ${day.slots.map((s) => slotCard(s, ctx)).join('')}`;
  } else {
    body = `
      <section class="card">
        <h2>${day.name}</h2>
        ${day.note ? `<p class="muted" style="margin-top:8px">${day.note}</p>` : ''}
        ${day.kind === 'off' ? '<p class="muted" style="margin-top:8px">Descansa. O treino de amanhã agradece.</p>' : ''}
      </section>`;
  }

  const isToday = date === today;
  const datePicker =
    day.kind !== 'lift'
      ? ''
      : `
    <label class="field log-date${isToday ? '' : ' not-today'}">
      <span>Registrando em${isToday ? '' : ' — RETROATIVO'}</span>
      <input type="date" id="log-date" value="${date}" max="${today}">
    </label>`;

  el.innerHTML = `
    <a class="back-link" href="#/treinos">‹ Treinos</a>
    <header class="page-head">
      <div>
        <h1>${day.name}</h1>
        <p class="muted small">${formatDateLong(date)}</p>
      </div>
      ${weekBadge(wk)}
    </header>
    ${datePicker}
    ${body}`;

  const rerender = async () => {
    const sy = window.scrollY;
    await render(el, dayKey, date);
    window.scrollTo(0, sy);
  };

  el.onchange = async (e) => {
    if (e.target.id === 'log-date' && e.target.value) {
      await render(el, dayKey, e.target.value);
    }
  };

  el.onclick = async (e) => {
    const stepBtn = e.target.closest('.step-btn');
    if (stepBtn) {
      const input = stepBtn.parentElement.querySelector('input');
      const step = parseFloat(stepBtn.dataset.delta);
      const next = Math.max(0, (parseNum(input.value) ?? 0) + step);
      input.value = String(Math.round(next * 100) / 100);
      return;
    }

    const rpeBtn = e.target.closest('.rpe-btn');
    if (rpeBtn) {
      const wasSelected = rpeBtn.classList.contains('selected');
      rpeBtn.parentElement.querySelectorAll('.rpe-btn').forEach((b) => b.classList.remove('selected'));
      if (!wasSelected) rpeBtn.classList.add('selected');
      return;
    }

    const del = e.target.closest('.del-set');
    if (del) {
      if (confirm('Apagar esta série?')) {
        await deleteLog(del.dataset.id);
        await rerender();
      }
      return;
    }

    const logBtn = e.target.closest('.log-btn');
    if (logBtn) {
      const card = logBtn.closest('.exercise');
      const weight = parseNum(card.querySelector('.in-weight').value);
      const reps = parseNum(card.querySelector('.in-reps').value);
      if (weight === null || weight < 0) { alert('Informe a carga (use 0 para peso corporal).'); return; }
      if (!reps || reps < 1) { alert('Informe as reps.'); return; }

      const selectedRpe = card.querySelector('.rpe-btn.selected');
      const rpe = selectedRpe && selectedRpe.dataset.rpe !== '' ? parseFloat(selectedRpe.dataset.rpe) : null;
      const notes = card.querySelector('.notes-input').value.trim();
      const exerciseId = card.dataset.ex;
      const setNumber =
        logs.filter((l) => l.date === date && l.exerciseId === exerciseId).length + 1;

      await addLog({
        date,
        dayKey,
        exerciseId,
        setNumber,
        weight,
        reps: Math.round(reps),
        rpe,
        notes,
        isDeload: deload,
      });
      await rerender();
    }
  };
}
