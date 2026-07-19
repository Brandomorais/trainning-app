/*
 * Tela de sessão de treino (rota #/treino/<dayKey>): aquecimento,
 * mobilidade e exercícios, logando cada série com prescrição pré-preenchida.
 */
import {
  DAYS,
  EXERCISES,
  CARDIO_MODALITIES,
  FIXED_WARMUP,
  MOBILITY_NOTE,
  RPE_SCALE,
  youtubeURL,
} from '../program.js';
import {
  getLogs,
  addLog,
  deleteLog,
  getCycle,
  getCardio,
  addCardio,
  deleteCardio,
  getSettings,
  setSettings,
  getExerciseNotes,
  setExerciseNote,
} from '../db.js';
import {
  toISODate,
  formatDateLong,
  cycleWeek,
  advise,
  parseTime,
  formatTime,
  paceFor,
  parseRestRange,
  rampSets,
  RAMP_STEPS,
  rampFloorMin,
  displayWeight,
  lbToKg,
} from '../progression.js';

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
  for (const m of day.mobility ?? []) items.push(videoRow(m));
  items.push(videoRow(FIXED_WARMUP));
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

/* Peso do chip na unidade do exercício ('lb' ganha sufixo; kg fica limpo). */
const chipWeight = (kg, unit) =>
  kg === 0 ? 'PC' : unit === 'lb' ? `${displayWeight(kg, 'lb')}lb` : String(displayWeight(kg, 'kg'));

function setChips(todaysSets, unit, timed = false) {
  if (!todaysSets.length) return '';
  const chips = todaysSets
    .map(
      (s) => `<span class="set-chip">S${s.setNumber} · ${chipWeight(s.weight, unit)}×${s.reps}${timed ? 's' : ''}${s.rpe ? ` @${s.rpe}` : ''}
        <button class="del-set" data-id="${s.id}" aria-label="Apagar série">✕</button></span>`
    )
    .join('');
  return `<div class="done-sets">${chips}</div>`;
}

/* ---------- Rampa de aquecimento (bloco de aquecimento) ---------- */
const fmtW = (w) => String(w).replace('.', ',');

/** Linha fixa em percentuais: "vazia×10 · 50%×5 · 70%×3 · 85%×2 · 93%×1". */
function rampPctText(fromFloor) {
  const parts = RAMP_STEPS.map((s) => `${Math.round(s.pct * 100)}%×${s.reps}`);
  return (fromFloor ? [] : ['vazia×10']).concat(parts).join(' · ');
}

/** Linha calculada da rampa para a carga digitada, na unidade ativa. */
function rampCalcText(slot, weight, unit) {
  const fromFloor = Boolean(EXERCISES[slot.exerciseId].rampFromFloor);
  const steps = rampSets(weight, { fromFloor, unit });
  if (!steps.length) return 'Informe a carga de trabalho para calcular.';
  const parts = steps.map((s, i) =>
    !fromFloor && i === 0 ? `vazia×${s.reps}` : `${fmtW(s.weight)}×${s.reps}`
  );
  return `${parts.join(' · ')} → ${fmtW(weight)}${unit}`;
}

/** Toggle kg|lb — mesma preferência do exercício (settings.units). */
const unitToggleHTML = (unit) => `
  <span class="unit-toggle" role="group" aria-label="Unidade do exercício">
    <button class="unit-btn${unit === 'kg' ? ' selected' : ''}" data-unit="kg">kg</button><button class="unit-btn${unit === 'lb' ? ' selected' : ''}" data-unit="lb">lb</button>
  </span>`;

/*
 * Um card por slot com `ramp: true`, logo após o aquecimento: percentuais
 * fixos, pausas (protocolo da literatura — ver docs/validacao-programa.md
 * §8.1) e calculadora com a carga de trabalho pré-preenchida pela sugestão
 * do dia (editável, sem vínculo com o formulário de série do exercício).
 */
function rampCardsHTML(day, ctx) {
  return (day.slots ?? [])
    .filter((s) => s.ramp)
    .map((slot) => {
      const ex = EXERCISES[slot.exerciseId];
      const fromFloor = Boolean(ex.rampFromFloor);
      const unit = ctx.units[slot.exerciseId] ?? 'kg';
      const advKg = advise(slot, ctx.logs, ctx.date, ctx.deload, ctx.dayKey, unit).weight;
      const pref = advKg == null ? '' : displayWeight(advKg, unit);
      return `
        <section class="card ramp-card" data-ramp-ex="${slot.exerciseId}">
          <h2>Rampa — ${ex.name}</h2>
          <p class="ramp-pct">${rampPctText(fromFloor)}</p>
          ${fromFloor ? `<p class="muted small">Com anilhas desde a 1ª aproximação (mín. ${rampFloorMin(unit)}${unit}) — sem barra vazia.</p>` : ''}
          <p class="muted small">Pausas: ~1min entre aproximações (troca de anilha) · 2-3min antes da 1ª série de trabalho.</p>
          <div class="unit-row">
            <span class="field-label">Carga de trabalho (${unit})</span>
            ${unitToggleHTML(unit)}
          </div>
          <input class="notes-input in-ramp-target" type="text" inputmode="decimal" value="${pref}" placeholder="${unit}">
          <p class="ramp-line">${rampCalcText(slot, parseNum(pref), unit)}</p>
        </section>`;
    })
    .join('');
}

/*
 * "⏱ volte ~HH:MM" no card da última série registrada: hora do registro +
 * piso do descanso prescrito. Só para registro de hoje (retroativo não faz
 * sentido) e some após 1h — reabrir o app à noite não mostra hora velha.
 */
function returnLineHTML(slot, ctx) {
  if (!ctx.lastLog || ctx.lastLog.exerciseId !== slot.exerciseId) return '';
  const range = parseRestRange(slot.rest);
  if (!range || Date.now() - ctx.lastLog.createdAt > 3600e3) return '';
  const t = new Date(ctx.lastLog.createdAt + range.min * 1000);
  const hhmm = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `<p class="return-line">⏱ volte ~${hhmm}</p>`;
}

/*
 * Alternativas: a troca vale só para o dia — o estado manual vive neste
 * módulo (keyed por data+dia+slot) e amanhã o card volta ao recomendado.
 * Se já há série registrada hoje em uma das opções, o card gruda nela.
 */
let slotChoices = {};

function activeExerciseId(slot, ctx) {
  const opts = [slot.exerciseId, ...(slot.alternatives ?? [])];
  const manual = slotChoices[`${ctx.date}|${ctx.dayKey}|${slot.exerciseId}`];
  if (manual && opts.includes(manual)) return manual;
  const logged = opts.find((id) =>
    ctx.logs.some((l) => l.date === ctx.date && l.dayKey === ctx.dayKey && l.exerciseId === id)
  );
  return logged ?? slot.exerciseId;
}

function altRowHTML(slot, activeId) {
  if (!slot.alternatives?.length) return '';
  const chips = [slot.exerciseId, ...slot.alternatives]
    .map(
      (id, i) =>
        `<button class="alt-btn${id === activeId ? ' selected' : ''}" data-alt="${id}">${i === 0 ? '★ ' : ''}${EXERCISES[id].name}</button>`
    )
    .join('');
  return `<div class="alt-row" data-slot="${slot.exerciseId}">${chips}</div>`;
}

function slotCard(slot, ctx) {
  const activeId = activeExerciseId(slot, ctx);
  const ex = EXERCISES[activeId];
  // Slot efetivo: prescrição do slot, exercício da opção ativa. A `note`
  // descreve a execução do recomendado — não vale para os fallbacks.
  const effSlot =
    activeId === slot.exerciseId ? slot : { ...slot, exerciseId: activeId, note: null, query: null, url: null };
  const todays = ctx.logs
    .filter((l) => l.date === ctx.date && l.exerciseId === activeId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const unit = ctx.units[activeId] ?? 'kg';
  const effSets = ctx.deload ? Math.max(1, Math.ceil(slot.sets / 2)) : slot.sets;
  const adv = advise(effSlot, ctx.logs, ctx.date, ctx.deload, ctx.dayKey, unit);
  const hintCls =
    adv.status === 'estagnado' ? ' hint-bad' : adv.status === 'atencao' ? ' hint-warn' : '';
  const timed = Boolean(ex.timed);
  const lastToday = todays[todays.length - 1];
  const prefKg = lastToday ? lastToday.weight : timed ? 0 : adv.weight;
  const prefWeight = prefKg == null ? '' : displayWeight(prefKg, unit);
  const prefReps = timed ? (lastToday?.reps ?? ex.secRange?.[0] ?? 30) : slot.reps ?? 10;
  const step = unit === 'lb' ? 5 : 2.5;
  const done = todays.length >= effSets;

  const prescription = timed
    ? `${effSets}x ${ex.secRange ? ex.secRange.join('-') : '30-60'}s`
    : `${effSets}x${slot.reps ?? ''}` +
      (slot.rpe && !ctx.deload ? ` @RPE${slot.rpe}` : '') +
      (effSlot.note ? ` (${effSlot.note})` : '');

  const targetRpe = ctx.deload ? null : slot.rpe;
  const rpeButtons = [6, 7, 8, 9, 10]
    .map(
      (v) =>
        `<button class="rpe-btn${v === targetRpe ? ' target' : ''}" data-rpe="${v}">${v}</button>`
    )
    .join('');

  return `
    <section class="card exercise" data-ex="${activeId}">
      <div class="ex-head">
        <h2>${ex.name}
          <a class="video-link-inline" href="${youtubeURL(effSlot.query || effSlot.url ? effSlot : ex)}" target="_blank" rel="noopener" aria-label="Ver técnica no YouTube">▶</a>
          ${done ? '<span class="done-mark">✓</span>' : ''}</h2>
        <span class="prescription">${prescription}</span>
      </div>
      ${altRowHTML(slot, activeId)}
      <p class="muted small ex-meta">Descanso ${slot.rest}${slot.ramp ? ' · rampa antes da 1ª série' : ''}</p>
      <p class="hint${hintCls}">${adv.text}</p>
      ${setChips(todays, unit, timed)}
      ${returnLineHTML(effSlot, ctx)}
      <div class="unit-row">
        <span class="field-label">Carga (${unit})</span>
        ${unitToggleHTML(unit)}
      </div>
      <div class="stepper">
        <button class="step-btn" data-delta="-${step}" aria-label="Menos ${step} ${unit}">−</button>
        <input class="in-weight" type="text" inputmode="decimal" value="${prefWeight}" placeholder="${unit}">
        <button class="step-btn" data-delta="${step}" aria-label="Mais ${step} ${unit}">+</button>
      </div>
      <label class="field-label">${timed ? 'Segundos' : 'Reps'}</label>
      <div class="stepper">
        <button class="step-btn" data-delta="-${timed ? 5 : 1}" aria-label="Menos ${timed ? '5 segundos' : '1 rep'}">−</button>
        <input class="in-reps" type="text" inputmode="numeric" value="${prefReps}">
        <button class="step-btn" data-delta="${timed ? 5 : 1}" aria-label="Mais ${timed ? '5 segundos' : '1 rep'}">+</button>
      </div>
      <label class="field-label">RPE ${targetRpe ? `(alvo ${targetRpe})` : '(opcional)'}</label>
      <div class="rpe-row">${rpeButtons}<button class="rpe-btn" data-rpe="">—</button></div>
      <input class="notes-input ex-notes" type="text" placeholder="Notas do exercício (opcional)" maxlength="200" value="${esc(ctx.noteFor(activeId))}">
      <button class="log-btn">${done ? 'Registrar série extra' : `Registrar série ${todays.length + 1}/${effSets}`}</button>
    </section>`;
}

/* ---------- Dia aeróbico ---------- */
const fmtDist = (meters, mod) =>
  mod.unit === 'km'
    ? `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
    : `${meters.toLocaleString('pt-BR')} m`;

const paceLabel = (mod) => (mod.paceRef === 1000 ? 'min/km' : `min/${mod.paceRef}m`);

function cardioChips(todays) {
  if (!todays.length) return '';
  const chips = todays
    .map((c) => {
      const mod = CARDIO_MODALITIES[c.modality] ?? { name: c.modality, unit: 'm', paceRef: 100 };
      const pace = paceFor(c.meters, c.seconds, mod.paceRef);
      return `<span class="set-chip">${mod.name} · ${fmtDist(c.meters, mod)} · ${formatTime(c.seconds)} · ${formatTime(pace)} ${paceLabel(mod)}
        <button class="del-cardio" data-id="${c.id}" aria-label="Apagar registro">✕</button></span>`;
    })
    .join('');
  return `<div class="done-sets">${chips}</div>`;
}

function cardioBody(day, ctx) {
  const todays = ctx.cardio
    .filter((c) => c.date === ctx.date)
    .sort((a, b) => a.createdAt - b.createdAt);
  const lastUsed = [...ctx.cardio].sort((a, b) => b.createdAt - a.createdAt)[0]?.modality;
  const selMod = CARDIO_MODALITIES[lastUsed] ? lastUsed : Object.keys(CARDIO_MODALITIES)[0];
  const mod = CARDIO_MODALITIES[selMod];

  const options = Object.entries(CARDIO_MODALITIES)
    .map(([k, m]) => `<option value="${k}"${k === selMod ? ' selected' : ''}>${m.name}</option>`)
    .join('');

  return `
    <section class="card cardio-form">
      <div class="ex-head">
        <h2>Registrar sessão
          <a class="video-link-inline" id="cardio-video" href="${youtubeURL(mod)}" target="_blank" rel="noopener" aria-label="Ver técnica no YouTube">▶</a>
          ${todays.length ? '<span class="done-mark">✓</span>' : ''}</h2>
      </div>
      ${day.note ? `<p class="muted small ex-meta">${day.note}</p>` : ''}
      ${cardioChips(todays)}
      <label class="field" style="margin-top:10px">
        <span>Modalidade</span>
        <select id="cardio-mod">${options}</select>
      </label>
      <label class="field-label">Distância (<span id="cardio-unit">${mod.unit}</span>)</label>
      <input class="notes-input in-dist" type="text" inputmode="decimal" placeholder="${mod.unit === 'km' ? 'ex.: 5 ou 5,2' : 'ex.: 1500'}" style="margin-top:0">
      <label class="field-label">Tempo</label>
      <input class="notes-input in-time" type="text" placeholder="42:30 (ou 1:02:10, ou só minutos)" style="margin-top:0">
      <p class="hint pace-preview" hidden></p>
      <input class="notes-input in-cardio-notes" type="text" placeholder="Notas (opcional)" maxlength="200">
      <button class="log-btn" id="cardio-log">Registrar sessão</button>
    </section>`;
}

function updatePacePreview(el) {
  const preview = el.querySelector('.pace-preview');
  if (!preview) return;
  const mod = CARDIO_MODALITIES[el.querySelector('#cardio-mod').value];
  const dist = parseNum(el.querySelector('.in-dist').value);
  const seconds = parseTime(el.querySelector('.in-time').value);
  const meters = dist && dist > 0 ? dist * (mod.unit === 'km' ? 1000 : 1) : null;
  const pace = meters && seconds ? paceFor(meters, seconds, mod.paceRef) : null;
  preview.hidden = !pace;
  if (pace) preview.textContent = `Pace: ${formatTime(pace)} ${paceLabel(mod)}`;
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
  const [logs, cycle, cardio, settings, exNotes] = await Promise.all([
    getLogs(),
    getCycle(),
    getCardio(),
    getSettings(),
    getExerciseNotes(),
  ]);
  const units = settings.units ?? {};
  const noteFor = (exerciseId) =>
    exNotes.find((n) => n.date === date && n.dayKey === dayKey && n.exerciseId === exerciseId)?.text ?? '';
  const wk = cycleWeek(cycle, date);
  const deload = wk?.deload ?? false;
  const lastLog =
    date === today
      ? logs
          .filter((l) => l.date === date && l.dayKey === dayKey)
          .reduce((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null)
      : null;
  const ctx = { logs, cardio, date, deload, dayKey, lastLog, units, noteFor };

  let body = '';
  if (day.kind === 'lift') {
    body = `
      ${deload ? '<div class="banner-deload">Semana de deload: ~60% da carga, metade das séries, sem RPE alto. As prescrições abaixo já estão ajustadas.</div>' : ''}
      ${day.noPR ? '<div class="banner-info">Dia leve — não buscar PR.</div>' : ''}
      ${warmupHTML(day)}
      ${rampCardsHTML(day, ctx)}
      ${rpeRefHTML()}
      ${day.slots.map((s) => slotCard(s, ctx)).join('')}`;
  } else if (day.kind === 'cardio') {
    body = cardioBody(day, ctx);
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
    day.kind !== 'lift' && day.kind !== 'cardio'
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
      return;
    }
    // Trocar a modalidade não rerenderiza para não apagar o que já foi digitado.
    if (e.target.id === 'cardio-mod') {
      const mod = CARDIO_MODALITIES[e.target.value];
      el.querySelector('#cardio-unit').textContent = mod.unit;
      el.querySelector('.in-dist').placeholder = mod.unit === 'km' ? 'ex.: 5 ou 5,2' : 'ex.: 1500';
      el.querySelector('#cardio-video').href = youtubeURL(mod);
      updatePacePreview(el);
    }
  };

  // Nota do exercício: auto-save com debounce (funciona sem registrar série).
  let noteTimer = null;
  const saveNote = (card) =>
    setExerciseNote({ date, dayKey, exerciseId: card.dataset.ex, text: card.querySelector('.ex-notes').value });

  el.oninput = (e) => {
    if (e.target.classList.contains('in-dist') || e.target.classList.contains('in-time')) {
      updatePacePreview(el);
    }
    if (e.target.classList.contains('ex-notes')) {
      const card = e.target.closest('.exercise');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => saveNote(card), 400);
    }
    if (e.target.classList.contains('in-ramp-target')) {
      const card = e.target.closest('.ramp-card');
      const slot = day.slots.find((s) => s.exerciseId === card.dataset.rampEx && s.ramp);
      const unit = units[card.dataset.rampEx] ?? 'kg';
      if (slot) card.querySelector('.ramp-line').textContent = rampCalcText(slot, parseNum(e.target.value), unit);
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

    const altBtn = e.target.closest('.alt-btn');
    if (altBtn) {
      const slotId = altBtn.closest('.alt-row').dataset.slot;
      slotChoices[`${date}|${dayKey}|${slotId}`] = altBtn.dataset.alt;
      await rerender();
      return;
    }

    const unitBtn = e.target.closest('.unit-btn');
    if (unitBtn) {
      // O toggle existe no card do exercício e no da rampa — mesma preferência.
      const exId =
        unitBtn.closest('.exercise')?.dataset.ex ?? unitBtn.closest('.ramp-card')?.dataset.rampEx;
      if (exId && (units[exId] ?? 'kg') !== unitBtn.dataset.unit) {
        await setSettings({ ...settings, units: { ...units, [exId]: unitBtn.dataset.unit } });
        await rerender();
      }
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

    const delCardio = e.target.closest('.del-cardio');
    if (delCardio) {
      if (confirm('Apagar este registro?')) {
        await deleteCardio(delCardio.dataset.id);
        await rerender();
      }
      return;
    }

    if (e.target.closest('#cardio-log')) {
      const mod = CARDIO_MODALITIES[el.querySelector('#cardio-mod').value];
      const dist = parseNum(el.querySelector('.in-dist').value);
      const seconds = parseTime(el.querySelector('.in-time').value);
      if (!dist || dist <= 0) { alert(`Informe a distância em ${mod.unit === 'km' ? 'quilômetros' : 'metros'}.`); return; }
      if (!seconds) { alert('Informe o tempo — ex.: 42:30, 1:02:10 ou só os minutos.'); return; }
      await addCardio({
        date,
        modality: el.querySelector('#cardio-mod').value,
        meters: Math.round(dist * (mod.unit === 'km' ? 1000 : 1)),
        seconds,
        notes: el.querySelector('.in-cardio-notes').value.trim(),
      });
      await rerender();
      return;
    }

    const logBtn = e.target.closest('.log-btn');
    if (logBtn) {
      const card = logBtn.closest('.exercise');
      const unit = units[card.dataset.ex] ?? 'kg';
      let weight = parseNum(card.querySelector('.in-weight').value);
      const reps = parseNum(card.querySelector('.in-reps').value);
      if (weight === null || weight < 0) { alert('Informe a carga (use 0 para peso corporal).'); return; }
      if (!reps || reps < 1) { alert('Informe as reps.'); return; }
      // Gravação sempre em kg — lb converte na borda.
      if (unit === 'lb' && weight > 0) weight = Math.round(lbToKg(weight) * 1000) / 1000;

      const selectedRpe = card.querySelector('.rpe-btn.selected');
      const rpe = selectedRpe && selectedRpe.dataset.rpe !== '' ? parseFloat(selectedRpe.dataset.rpe) : null;
      const exerciseId = card.dataset.ex;
      const setNumber =
        logs.filter((l) => l.date === date && l.exerciseId === exerciseId).length + 1;

      clearTimeout(noteTimer);
      await saveNote(card); // nota digitada agora não se perde no rerender
      await addLog({
        date,
        dayKey,
        exerciseId,
        setNumber,
        weight,
        reps: Math.round(reps),
        rpe,
        isDeload: deload,
      });
      await rerender();
    }
  };
}
