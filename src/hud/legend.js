// Map legend for the current mode: speed ramp and arrow scale (with its scale factor), target status colours, dune classes and their toggles.
import { state, set } from '../state.js';
import { esc, int, num, isNum, statusWords } from '../format.js';
import { SPEED_DOMAIN, speedColor, STATUS_COLORS, CLASS_COLORS } from '../layers/util.js';
import { ARROW_YEARS } from '../layers/vectors.js';

function gradient() {
  const stops = [];
  for (let i = 0; i <= 20; i++) {
    const v = SPEED_DOMAIN[0] + ((SPEED_DOMAIN[1] - SPEED_DOMAIN[0]) * i) / 20;
    stops.push(`${speedColor(v).toCssColorString()} ${i * 5}%`);
  }
  return `linear-gradient(90deg, ${stops.join(',')})`;
}

const SECTIONS = { true: ['dunes', 'targets'], motion: ['speed', 'dunes'], threat: ['targets', 'speed'] };

export function renderLegend(body, b, { projected }) {
  const sections = SECTIONS[state.mode] || ['speed', 'targets', 'dunes'];
  const lim = b.summary?.detection_limit_myr;
  const f = state.arrowFactor;
  const counts = b.derived.statusCounts;
  const cls = b.summary?.counts_by_class || {};
  const html = sections.map((s) => {
    if (s === 'speed') {
      const ticks = [0, 1, 2, 3, 4].map((v) => `<span style="left:${(v / SPEED_DOMAIN[1]) * 100}%">${v}${v === 4 ? '+' : ''}</span>`).join('');
      return `<div class="lg-sec">
        <div class="lg-title">Measured motion, m/yr <span class="dim">(Landsat 8/9, 2013–2025)</span></div>
        <div class="ramp" style="background:${gradient()}"></div><div class="ramp-ticks">${ticks}</div>
        <div class="lg-row">Arrow length = <b>${ARROW_YEARS * f} yr</b> of motion (1 m/yr → ${ARROW_YEARS * f} m)</div>
        <div class="lg-row lg-ctl">Scale <span class="seg-s">${[1, 2, 4].map((k) => `<button data-factor="${k}" class="${k === f ? 'on' : ''}" title="${ARROW_YEARS * k} years of motion">×${k}</button>`).join('')}</span><span class="dim">of the ${ARROW_YEARS}-yr base · fainter = weaker match</span></div>
        <div class="lg-row dim">No arrow: below detection limit${isNum(lim) ? ` (&lt; ${num(lim, 2)} m/yr)` : ''} or not dune sand</div>
        ${projected ? '<div class="lg-row"><i class="sw-line" style="background:#ffd166"></i>Track: true-scale displacement since the latest scene</div>' : ''}
      </div>`;
    }
    if (s === 'targets') {
      const order = ['sand_at_edge_now', 'reached_by_2050', 'reached_2051_2100', 'possible_within_direction_uncertainty', 'not_reached_by_2100'];
      const keys = [...order.filter((k) => counts[k]), ...Object.keys(counts).filter((k) => !order.includes(k))];
      return `<div class="lg-sec">
        <div class="lg-title">Targets by threat status</div>
        ${keys.map((k) => `<div class="lg-row"><i class="sw-line" style="background:${STATUS_COLORS[k] || '#888'}"></i>${esc(statusWords(k))} <span class="dim">${int(counts[k])}</span></div>`).join('')}
        <div class="lg-row dim">Bright and pulsing = reached by the year shown; faint = reached later</div>
        <label class="lg-row lg-ctl"><input type="checkbox" data-toggle="exposed" ${state.exposed ? 'checked' : ''}> <span>Exposed to blowing sand today <span class="dim">(borders free sand; not forecast by this tool)</span></span></label>
      </div>`;
    }
    return `<div class="lg-sec">
      <div class="lg-title">Large dunes <span class="dim">(NASADEM outline, 2025 position)</span></div>
      <div class="lg-row lg-classes">${['stable', 'slow', 'active', 'fast'].map((c) => `<span><i class="sw-line" style="background:${CLASS_COLORS[c]}"></i>${c} <span class="dim">${int(cls[c]) ?? 0}</span></span>`).join('')}</div>
      <label class="lg-row lg-ctl"><input type="checkbox" data-toggle="thenNow" ${state.thenNow === 'overlay' ? 'checked' : ''}> <span>Then vs now: overlay Feb 2000 outlines <span class="dim">(dotted)</span></span></label>
    </div>`;
  });
  body.innerHTML = html.join('');
  body.querySelectorAll('[data-factor]').forEach((el) => el.addEventListener('click', () => set('arrowFactor', +el.dataset.factor)));
  body.querySelector('[data-toggle="exposed"]')?.addEventListener('change', (e) => set('exposed', e.target.checked));
  body.querySelector('[data-toggle="thenNow"]')?.addEventListener('change', (e) => set('thenNow', e.target.checked ? 'overlay' : 'now'));
}
