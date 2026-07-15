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

/**
 * points: [{ label, value, deload }] em ordem cronológica.
 * Renderiza dentro de `container` (limpa o conteúdo) e liga a interação.
 */
export function renderLineChart(container, points) {
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
    .map((t) => `<text x="${PAD.left - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--axis-ink)">${t.toLocaleString('pt-BR')}</text>`)
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
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progressão de e1RM">
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
    tip.innerHTML = `${p.label}${p.deload ? ' · deload' : ''}<br><b>${p.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</b>`;
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
