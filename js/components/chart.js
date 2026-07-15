/*
 * Gráfico de linha SVG para progressão de e1RM — série única.
 * Marcas: linha 2px, marcadores r=4.5 com anel de 2px na cor da superfície,
 * gridlines hairline sólidas, texto de eixo em cinza recessivo.
 * Interação: tocar/arrastar mostra crosshair + tooltip do ponto mais próximo.
 * Sessões de deload usam marcador vazado (canal além da cor).
 */

const W = 600;
const H = 260;
const PAD = { top: 14, right: 14, bottom: 30, left: 44 };

function niceTicks(min, max, target = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const rawStep = span / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target) || 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

const defaultFmtValue = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
const defaultFmtTick = (t) => t.toLocaleString('pt-BR');

/**
 * points: [{ label, value, deload }] em ordem cronológica.
 * opts: { fmtValue (tooltip), fmtTick (eixo y), ariaLabel }.
 * Renderiza dentro de `container` (limpa o conteúdo) e liga a interação.
 */
export function renderLineChart(container, points, opts = {}) {
  const fmtValue = opts.fmtValue ?? defaultFmtValue;
  const fmtTick = opts.fmtTick ?? defaultFmtTick;
  container.innerHTML = '';
  if (!points.length) return;

  const values = points.map((p) => p.value);
  let vMin = Math.min(...values);
  let vMax = Math.max(...values);
  const padV = Math.max((vMax - vMin) * 0.12, 2);
  vMin = Math.max(0, vMin - padV);
  vMax += padV;
  const ticks = niceTicks(vMin, vMax);
  if (ticks.length) {
    vMin = Math.min(vMin, ticks[0]);
    vMax = Math.max(vMax, ticks[ticks.length - 1]);
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => (points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  const grid = ticks
    .map((t) => `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/>`)
    .join('');
  const yLabels = ticks
    .map((t) => `<text x="${PAD.left - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--axis-ink)">${fmtTick(t)}</text>`)
    .join('');

  // Rótulos de x: primeiro, meio e último (sem poluir).
  const xIdx = points.length <= 3
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = [...new Set(xIdx)]
    .map((i) => {
      const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
      return `<text x="${x(i)}" y="${H - 8}" text-anchor="${anchor}" font-size="11" fill="var(--axis-ink)">${points[i].label}</text>`;
    })
    .join('');

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  // Anel de 2px na cor da superfície por baixo de cada marcador (legível sobre a linha);
  // deload = marcador vazado (identidade além da cor).
  const dots = points
    .map((p, i) => {
      const cx = x(i).toFixed(1);
      const cy = y(p.value).toFixed(1);
      const fill = p.deload ? 'var(--card)' : 'var(--series-1)';
      return `<circle cx="${cx}" cy="${cy}" r="6.5" fill="var(--card)"/>` +
        `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${fill}" stroke="var(--series-1)" stroke-width="2"/>`;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.ariaLabel ?? 'Progressão de e1RM'}">
      ${grid}
      <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${PAD.top + plotH}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="1"/>
      ${yLabels}
      ${xLabels}
      <path d="${path}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line class="crosshair" x1="0" x2="0" y1="${PAD.top}" y2="${PAD.top + plotH}" stroke="var(--axis-ink)" stroke-width="1" visibility="hidden"/>
      ${dots}
    </svg>
    <div class="chart-tip"></div>
  `;

  const svg = container.querySelector('svg');
  const tip = container.querySelector('.chart-tip');
  const cross = container.querySelector('.crosshair');

  function showNearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - relX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    const p = points[best];
    cross.setAttribute('x1', x(best));
    cross.setAttribute('x2', x(best));
    cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `${p.label}${p.deload ? ' · deload' : ''}<br><b>${fmtValue(p.value)}</b>`;
    tip.style.display = 'block';
    const fx = (x(best) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(fx, 55), rect.width - 55)}px`;
  }

  svg.addEventListener('pointerdown', (e) => showNearest(e.clientX));
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') showNearest(e.clientX); });
  svg.addEventListener('pointerleave', () => {
    tip.style.display = 'none';
    cross.setAttribute('visibility', 'hidden');
  });
}

/*
 * Gráfico de barras SVG — série única, valores inteiros pequenos
 * (treinos por semana). Topo arredondado de 4px ancorado na linha de base;
 * semana de deload = barra vazada (canal além da cor). Tooltip por barra.
 */
export function renderBarChart(container, points, opts = {}) {
  const fmtValue = opts.fmtValue ?? ((v) => String(v));
  container.innerHTML = '';
  if (!points.length) return;

  const BH = 200;
  const pad = { top: 12, right: 14, bottom: 30, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = BH - pad.top - pad.bottom;
  const baseY = pad.top + plotH;
  const vMax = Math.max(4, ...points.map((p) => p.value));
  const y = (v) => baseY - (v / vMax) * plotH;

  const slot = plotW / points.length;
  const barW = Math.min(36, slot * 0.62);
  const bx = (i) => pad.left + slot * i + (slot - barW) / 2;
  const center = (i) => bx(i) + barW / 2;

  const step = vMax <= 6 ? 1 : Math.ceil(vMax / 4);
  const ticks = [];
  for (let t = 0; t <= vMax; t += step) ticks.push(t);

  const grid = ticks
    .map((t) => `<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/>`)
    .join('');
  const yLabels = ticks
    .map((t) => `<text x="${pad.left - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--axis-ink)">${t}</text>`)
    .join('');

  const xIdx = points.length <= 3
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = [...new Set(xIdx)]
    .map((i) => {
      const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
      return `<text x="${center(i)}" y="${BH - 8}" text-anchor="${anchor}" font-size="11" fill="var(--axis-ink)">${points[i].label}</text>`;
    })
    .join('');

  const bars = points
    .map((p, i) => {
      if (p.value <= 0) return '';
      const x0 = bx(i);
      const top = y(p.value);
      const r = Math.min(4, baseY - top);
      const d = `M${x0},${baseY} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} ` +
        `L${x0 + barW - r},${top} Q${x0 + barW},${top} ${x0 + barW},${top + r} L${x0 + barW},${baseY} Z`;
      return p.deload
        ? `<path d="${d}" fill="var(--card)" stroke="var(--series-1)" stroke-width="2"/>`
        : `<path d="${d}" fill="var(--series-1)"/>`;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${BH}" role="img" aria-label="${opts.ariaLabel ?? 'Treinos por semana'}">
      ${grid}
      <line x1="${pad.left}" x2="${W - pad.right}" y1="${baseY}" y2="${baseY}" stroke="var(--border)" stroke-width="1"/>
      ${yLabels}
      ${xLabels}
      ${bars}
    </svg>
    <div class="chart-tip"></div>
  `;

  const svg = container.querySelector('svg');
  const tip = container.querySelector('.chart-tip');

  function showNearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(center(i) - relX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    const p = points[best];
    tip.innerHTML = `semana de ${p.label}${p.deload ? ' · deload' : ''}<br><b>${fmtValue(p.value)}</b>`;
    tip.style.display = 'block';
    const fx = (center(best) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(fx, 65), rect.width - 65)}px`;
  }

  svg.addEventListener('pointerdown', (e) => showNearest(e.clientX));
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') showNearest(e.clientX); });
  svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
}
