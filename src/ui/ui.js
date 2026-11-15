// DuneSight UI: header, panels (speed, wind, reached places, selection), timeline, legend, first-visit guide, mobile sheet, credits footer.
// Plain JS, no framework. Usage:
//   import { mountDuneSightUI } from './ui/ui.js';
//   const ui = mountDuneSightUI(document.getElementById('app'), { data, sites, onModeChange, ... });
// The container must be position: relative (or fixed) and cover the Cesium viewer.
// Every number it shows comes from `data` (built per site by site-data.js from the published files).

const COL = {
  measured: '#7FAEEA', projected: '#CFC6B4', wind: '#EDE6D8', text: '#EDE6D8', text2: '#BDB3A2', text3: '#948B7C',
  panel: '#1E1B17', casing: 'rgba(21,19,15,0.62)',
  stable: '#9AA3AD', slow: '#BBD5F5', active: '#6FA0E6', fast: '#3866CC',
  now: '#E5533D', by2050: '#F08A3C', by2100: '#F5C15A', possible: '#4DBFA0', none: '#8E8779',
};
// Same values as tokens.css. Use these for the Cesium polylines too, so map and legend always match.
export const MAP_STYLE = {
  dune: { stable: [COL.stable, 1.25], slow: [COL.slow, 1.75], active: [COL.active, 2.25], fast: [COL.fast, 3] },
  dune2000: [COL.text, 1.25, '1 3'],
  arrow: [COL.measured, 1.75],
  threat: { now: [COL.now, 3.5], by2050: [COL.by2050, 3], by2100: [COL.by2100, 2.5], possible: [COL.possible, 2.5, '5 3'], none: [COL.none, 1.5] },
  box: [COL.text, 1],
  boxProjected: [COL.projected, 1.5, '10 6'], // study-area edge in projected years
  track: [COL.projected, 2.5], // true-scale shift of an arrow since the latest scene, in projected years
  exposed: [COL.text, 7, '4 4'], // wide dashed halo under targets that border free sand
  casing: COL.casing, // draw under every line at width + 2
  projected: COL.projected,
  measured: COL.measured,
  text: COL.text,
};
/** Threat-status value in targets.geojson -> legend/style key. */
export const STATUS_KEY = {
  sand_at_edge_now: 'now',
  reached_by_2050: 'by2050',
  reached_2051_2100: 'by2100',
  possible_within_direction_uncertainty: 'possible',
  not_reached_by_2100: 'none',
};

const NAMES = { true: 'True view', motion: 'Motion', threat: 'Threat' };
const DEFAULT_LAYERS = {
  true: { box: true, dunes: false, dunes2000: false, vectors: false, targets: false, exposed: false, projected: true },
  motion: { vectors: true, dunes: true, dunes2000: false, projected: true, box: true },
  threat: { t_now: true, t_by2050: true, t_by2100: true, t_possible: true, t_none: true, exposed: false, vectors: true, dunes: true, dunes2000: false, projected: true, box: true },
};

// ---------- small helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const n = (v, d = 0) => (!isNum(v) ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage off */ } },
};
const ICONS = {
  chevUp: '<path d="M6 15l6-6 6 6"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="2"/>',
  back: '<path d="M6 5v14M18 5l-9 7 9 7z"/>',
  fwd: '<path d="M18 5v14M6 5l9 7-9 7z"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
  topdown: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
  book: '<path d="M3.5 5h6a2.5 2.5 0 0 1 2.5 2.5V20a2 2 0 0 0-2-2H3.5z"/><path d="M20.5 5h-6A2.5 2.5 0 0 0 12 7.5V20a2 2 0 0 1 2-2h6.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  logo: '<path d="M2 17.5c3.2-5 6.4-6.2 9.5-3s6.8 2.6 10.5-3"/><path d="M2 11.5c2.4-3.4 4.8-4.2 7.2-2.2"/>',
};
const icon = (name, size = 16, sw = 1.5) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const statusMark = (s) => {
  const ring = '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/>';
  const inner = s === 'confirmed' ? '<circle cx="7" cy="7" r="6" fill="currentColor"/>'
    : s === 'partly' ? ring + '<path d="M7 1.5a5.5 5.5 0 0 0 0 11z" fill="currentColor"/>' : ring;
  return `<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">${inner}</svg>`;
};
const STATUS_TEXT = { confirmed: 'confirmed', partly: 'partly confirmed', not: 'not confirmed' };

// line samples: identical strokes to the map
const lineSample = ([c, w, dash]) =>
  `<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><line x1="2" y1="6" x2="26" y2="6" stroke="${COL.casing}" stroke-width="${w + 2}"/><line x1="2" y1="6" x2="26" y2="6" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/></svg>`;
const outlineSample = ([c, w, dash], width = 28) => {
  const d = `M3 11 C 6 2, ${width - 12} 1, ${width - 3} 10`;
  return `<svg width="${width}" height="14" viewBox="0 0 ${width} 14" aria-hidden="true"><path d="${d}" fill="none" stroke="${COL.casing}" stroke-width="${w + 2}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/></svg>`;
};
const arrowSample = () =>
  `<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><g transform="rotate(-37 14 6)"><line x1="5" y1="6" x2="20" y2="6" stroke="${COL.casing}" stroke-width="3.75" stroke-linecap="round"/><line x1="5" y1="6" x2="20" y2="6" stroke="${COL.measured}" stroke-width="1.75" stroke-linecap="round"/><path d="M23 6 L17.5 3 L17.5 9 Z" fill="${COL.measured}"/></g></svg>`;
const exposedSample = () => {
  const [c, w, dash] = MAP_STYLE.exposed;
  return `<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><line x1="2" y1="6" x2="26" y2="6" stroke="${c}" stroke-opacity="0.8" stroke-width="${w}" stroke-dasharray="${dash}"/><line x1="2" y1="6" x2="26" y2="6" stroke="${COL.casing}" stroke-width="${MAP_STYLE.threat.now[1] + 2}"/><line x1="2" y1="6" x2="26" y2="6" stroke="${COL.now}" stroke-width="${MAP_STYLE.threat.now[1]}"/></svg>`;
};

const compassName = (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
// trailing space: the tag reads as its own word (screen readers, copied text)
const projTag = '<span class="ds-tag-projected">PROJECTED</span> ';
const measTag = '<span class="ds-tag-measured">MEASURED</span> ';
const srcLine = (text, anchor) => `<p class="ds-src ds-caption">Source: ${text} · <button type="button" class="ds-link" data-dossier="${anchor}">How we know</button></p>`;

// ---------- compass ----------
function compassSVG(w) {
  const W = 320, R = 72, cx = 160, cy = R + 46, H = 2 * cy;
  const P = (b, r, x = cx, y = cy) => [x + r * Math.sin(b * Math.PI / 180), y - r * Math.cos(b * Math.PI / 180)];
  const f = (v) => v.toFixed(1);
  const has = (v) => isNum(v);
  const aria = [
    has(w.rddDeg) ? `Wind pushes sand toward ${w.rddDeg} degrees.` : '',
    has(w.duneDeg) ? `Dunes measured moving toward ${w.duneDeg} degrees.` : '',
    has(w.apartDeg) ? `${w.apartDeg} degrees apart.` : '',
    has(w.stationDeg) ? `Ground station: toward ${w.stationDeg} degrees.` : '',
  ].join(' ');
  let s = `<svg class="ds-compass" viewBox="0 0 ${W} ${H}" role="img" aria-label="Compass. ${aria}">`;
  // petals: the wind blowing FROM each sector (sector_deg from the data), radius from the square root so area follows drift potential
  const rose = w.rose || [];
  const maxV = Math.max(...rose.map((p) => p.dp), 1e-9);
  const halfW = rose.length ? 360 / rose.length / 2 - 1.75 : 0;
  rose.forEach(({ deg, dp }) => {
    const r = R * 0.92 * Math.sqrt(dp / maxV);
    const [x1, y1] = P(deg - halfW, r), [x2, y2] = P(deg + halfW, r);
    s += `<path class="ds-petal" d="M${cx} ${cy} L${f(x1)} ${f(y1)} A${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(y2)} Z" fill="rgba(237,230,216,0.13)" stroke="rgba(237,230,216,0.22)" stroke-width="0.75"><title>Wind from ${n(deg, 1)}°: drift potential ${n(dp, 2)} VU/yr</title></path>`;
  });
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(237,230,216,0.30)"/><circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="rgba(237,230,216,0.12)"/>`;
  for (let b = 0; b < 360; b += 30) {
    const [x1, y1] = P(b, R), [x2, y2] = P(b, R - (b % 90 ? 4 : 7));
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="rgba(237,230,216,0.45)"/>`;
  }
  s += `<text x="${cx - 9}" y="${cy - R + 21}" text-anchor="middle" font-size="12" font-weight="600" fill="${COL.text2}" stroke="${COL.panel}" stroke-width="3" paint-order="stroke">N</text>`;
  // arc between dunes and wind
  let a0 = w.duneDeg, diff = null;
  if (has(w.duneDeg) && has(w.rddDeg)) {
    let a1 = w.rddDeg;
    diff = ((a1 - a0) % 360 + 360) % 360;
    if (diff > 180) { [a0, a1] = [a1, a0]; diff = 360 - diff; }
    const [ax, ay] = P(a0, 40), [bx, by] = P(a1, 40);
    if (diff > 0.5) s += `<path d="M${f(ax)} ${f(ay)} A40 40 0 0 1 ${f(bx)} ${f(by)}" fill="none" stroke="${COL.text}"/>`;
  }
  const arrow = (b, r, c, width, dash, cls) => {
    const [tx, ty] = P(b, r), [hx, hy] = P(b, r - 9), [lx, ly] = P(b - 90, 4.2, hx, hy), [rx, ry] = P(b + 90, 4.2, hx, hy);
    return `<g class="${cls}"><line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="${COL.panel}" stroke-width="${width + 2.5}" stroke-linecap="round"/>`
      + `<line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="${c}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
      + `<path d="M${f(tx)} ${f(ty)} L${f(lx)} ${f(ly)} L${f(rx)} ${f(ry)} Z" fill="${c}" stroke="${COL.panel}"/></g>`;
  };
  if (has(w.stationDeg)) s += arrow(w.stationDeg, 64, COL.wind, 1.5, '4 3', 'ds-arr-station');
  if (has(w.rddDeg)) s += arrow(w.rddDeg, R, COL.wind, 2.75, null, 'ds-arr-rdd');
  if (has(w.duneDeg)) s += arrow(w.duneDeg, R, COL.measured, 2.75, null, 'ds-arr-dune');
  s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${COL.text}"/>`;
  const halo = `stroke="${COL.panel}" stroke-width="4" paint-order="stroke" stroke-linejoin="round"`;
  // labels: placed at their bearing, then pushed apart vertically where two would overlap (e.g. wind and dunes a few degrees apart)
  const labels = [];
  const addLabel = (b, r, lines, color) => {
    const [x, y] = P(b, r), sn = Math.sin(b * Math.PI / 180), cs = Math.cos(b * Math.PI / 180);
    const anchor = sn > 0.25 ? 'start' : sn < -0.25 ? 'end' : 'middle';
    const y0 = cs > 0.5 ? y - (lines.length - 1) * 14 - 2 : cs < -0.5 ? y + 12 : y - (lines.length - 1) * 7 + 4;
    const wid = Math.max(...lines.map((t) => t.length)) * 6.6;
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - wid : x - wid / 2;
    labels.push({ x, y0, anchor, lines, color, box: { x0, x1: x0 + wid, y0: y0 - 11, y1: y0 - 11 + lines.length * 14 }, down: cs < 0 });
  };
  if (has(w.duneDeg)) addLabel(w.duneDeg, R + 9, ['Dunes moving', `toward ${w.duneDeg}° ${compassName(w.duneDeg)}`], COL.measured);
  if (has(w.rddDeg)) addLabel(w.rddDeg, R + 9, ['Wind push', `toward ${w.rddDeg}° ${compassName(w.rddDeg)}`], COL.text);
  if (has(w.stationDeg)) addLabel(w.stationDeg, R + 9, ['Station', `toward ${w.stationDeg}° ${compassName(w.stationDeg)}`], COL.text2);
  for (let i = 1; i < labels.length; i++) {
    for (let k = 0; k < i; k++) {
      const a = labels[k].box, L = labels[i], b = L.box;
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 0 && oy > -2) {
        const shift = L.down ? a.y1 - b.y0 + 3 : -(b.y1 - a.y0 + 3);
        L.y0 += shift; b.y0 += shift; b.y1 += shift;
      }
    }
  }
  for (const L of labels) s += L.lines.map((t, i) => `<text x="${f(L.x)}" y="${f(L.y0 + i * 14)}" text-anchor="${L.anchor}" font-size="12" font-weight="${i ? 400 : 600}" fill="${L.color}" ${halo}>${esc(t)}</text>`).join('');
  if (diff !== null && diff >= 18) {
    const [gx, gy] = P(a0 + diff / 2, 55);
    s += `<text x="${f(gx)}" y="${f(gy + 4)}" text-anchor="middle" font-size="12" font-weight="600" fill="${COL.text}" ${halo}>${w.apartDeg}°</text>`;
  }
  // grow the drawing to hold labels pushed above or below it, so they never sit on the text around the compass
  const top = Math.min(0, ...labels.map((L) => L.box.y0 - 4)), bottom = Math.max(H, ...labels.map((L) => L.box.y1 + 4));
  s = s.replace(`viewBox="0 0 ${W} ${H}"`, `viewBox="0 ${f(top)} ${W} ${f(bottom - top)}"`);
  return s + '</svg>';
}

// ---------- panels ----------
function phead(key, title, summary) {
  return `<div class="ds-phead"><h2>${title}<span class="ds-sum"> · ${summary}</span></h2>`
    + `<button type="button" class="ds-icon-btn" data-collapse="${key}" aria-label="Collapse or expand: ${title}" aria-expanded="true">${icon('chevUp')}</button></div>`;
}
function details(key, inner, label = 'Details') {
  return `<button type="button" class="ds-dtoggle" data-details="${key}" aria-expanded="false"><span>${label}</span>${icon('chevDown')}</button>`
    + `<div class="ds-details" data-open="false" id="ds-det-${key}"><div>${inner}</div></div>`;
}
const dl = (rows) => `<dl class="ds-dl">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

function speedPanel(d) {
  const s = d.speed, max = s.axisMax || 1.5, pc = (v) => `${(Math.min(Math.max(v, 0), max) / max) * 100}%`;
  const lim = s.detectionLimit;
  const below = !isNum(s.median) || (isNum(lim) && s.median < lim);
  const lead = below
    ? `Sand here moves too slowly to measure: <strong>below detection limit (&lt; ${n(lim, 2)} m/yr)</strong>.`
    : `Sand here moves about <strong>${n(s.median, 2)} m a year</strong>${s.headingName ? `, toward the ${esc(s.headingName)} (${s.headingDeg}°)` : ''}.`;
  let ticks = '';
  for (let v = 0; v <= max + 1e-9; v += 1) {
    const isMax = Math.abs(v - max) < 1e-9;
    ticks += `<div class="ds-range__lbl" style="left:${pc(v)};transform:translateX(${v === 0 ? '0' : isMax ? '-100%' : '-50%'})">${v}${isMax ? ' m/yr' : ''}</div>`;
  }
  if (!Number.isInteger(max)) ticks += `<div class="ds-range__lbl" style="right:0">${n(max, 1)} m/yr</div>`;
  const range = `<div class="ds-range" role="img" aria-label="Median ${n(s.median, 2)} m per year. Most moving sand ${n(s.p10, 2)} to ${n(s.p90, 2)} m per year. Below ${n(lim, 2)} m per year is too slow to detect.">`
    + (below ? '' : `<div class="ds-range__median" style="left:${pc(s.median)}">Median ${n(s.median, 2)} m/yr</div>`)
    + `<div class="ds-range__track"></div>${isNum(lim) ? `<div class="ds-range__below" style="width:${pc(lim)}"></div>` : ''}`
    + (isNum(s.p10) && isNum(s.p90) ? `<div class="ds-range__band" style="left:${pc(s.p10)};width:calc(${pc(s.p90)} - ${pc(s.p10)})"></div>` : '')
    + (below ? '' : `<div class="ds-range__tick" style="left:${pc(s.median)}"></div>`)
    + ticks
    + `<div class="ds-range__key ds-small"><span><i class="ds-swatch-band"></i>Most moving sand: ${n(s.p10, 2)}–${n(s.p90, 2)} m/yr (10–90%)</span>`
    + (isNum(lim) ? `<span><i class="ds-swatch-below"></i>Too slow to detect: &lt; ${n(lim, 2)} m/yr (no arrow, no direction)</span>` : '')
    + `</div></div>`;
  const conf = d.confidence
    ? `<div class="ds-conf">${['speed', 'heading'].map((k) => {
      const c = d.confidence[k];
      if (!c) return '';
      return `<p class="ds-small" data-confirm="${k}" data-status="${esc(c.raw)}">${statusMark(c.status)}<span><b>${k === 'speed' ? 'Speed' : 'Heading'}: ${STATUS_TEXT[c.status]}.</b> ${esc(c.text)}</span></p>`;
    }).join('')}<button type="button" class="ds-link ds-small" data-dossier="crosschecks">How each check compares ${icon('arrow', 13)}</button></div>`
    : '<p class="ds-small">No independent cross-check is published for this site.</p>';
  const du = d.dunes, th = du.thresholds;
  const classes = [['stable', 'Stable', 'below limit'], ['slow', 'Slow', th ? `&lt; ${n(th.slow, 2)}` : ''], ['active', 'Active', th ? `&lt; ${n(th.active, 2)}` : ''], ['fast', 'Fast', th ? `≥ ${n(th.fast, 2)}` : '']];
  const dunes = `<h3 class="ds-h3">${n(du.total)} large dunes outlined <span>· by how fast the sand on and around them moves, m/yr</span></h3>`
    + `<div class="ds-stack" role="img" aria-label="${classes.map(([k, l]) => `${du[k]} ${l}`).join(', ')}">${classes.filter(([k]) => du[k] > 0).map(([k]) => `<span style="flex:${du[k]} 1 0;background:${COL[k]}"></span>`).join('')}</div>`
    + `<div class="ds-dkey">${classes.map(([k, l, t]) => `<div><div><i style="background:${COL[k]}"></i>${l} <strong>${du[k]}</strong></div><div class="ds-caption">${t}</div></div>`).join('')}</div>`
    + `<p class="ds-caption" style="margin-top:4px">Measured in 480 m windows around each outline: the sand surface and smaller dunes, not the body of the large dune.</p>`;
  const t = d.targets;
  const row = (label, sw, r) => `<tr><th scope="row">${sw}${label}</th><td>${n(r.all)}</td><td>${n(r.roads)}</td><td>${n(r.farms)}</td><td>${n(r.built)}</td></tr>`;
  const risk = `<h3 class="ds-h3">At risk <span>· of ${n(t.total)} roads, farms, built-up areas</span></h3>`
    + `<table class="ds-table"><thead><tr><th scope="col"><span class="ds-sr">Status</span></th><th scope="col">All</th><th scope="col">Roads</th><th scope="col">Farms</th><th scope="col">Built-up</th></tr></thead><tbody>`
    + row('Sand at edge now', `<i style="background:${COL.now}"></i>`, t.edgeNow)
    + row('Reached by 2050*', `<i style="background:${COL.by2050};box-shadow:inset 5px 0 0 ${COL.now}"></i>`, t.by2050)
    + `</tbody></table><p class="ds-caption" style="margin-top:4px">*Includes edge-now; fast-case reach year (speed + 1σ).</p>`;
  const p = d.projection2050;
  const callout = p ? `<div class="ds-callout"><p>${projTag}In the median case, by ${p.year} moving sand shifts a median <strong>${n(p.median, 1)} m</strong> (p90 ${n(p.p90, 1)} m); <strong>${n(p.areaPct, 1)}%</strong> of the box moves.</p></div>` : '';
  const x = d.details;
  const det = dl([
    isNum(x.windowsPct) ? ['Motion found', `${n(x.windowsPct, 1)}% of ${n(x.windows)} valid dune windows${x.windowSize ? ` (${esc(x.windowSize)})` : ''} show motion. The rest move slower than the detection limit (&lt; ${n(lim, 2)} m/yr).`] : null,
    x.baseline ? ['Baseline', `${esc(x.baseline)}${isNum(s.sigma) ? `, ±${n(s.sigma, 2)} m/yr (1σ per window)` : ''}`] : null,
    s.headingLabel ? ['Heading', `${s.headingDeg}°: ${esc(s.headingLabel)}`] : null,
    ['Dune outlines', esc(x.outlines)],
  ]) + `<button type="button" class="ds-more" data-action="howWeKnow">How we know ${icon('arrow', 14)}</button>`;
  const summary = below ? 'below detection limit' : `${n(s.median, 2)} m/yr${isNum(s.headingDeg) ? `, ${compassName(s.headingDeg)}` : ''}`;
  return `<section class="ds-panel ds-panel--speed" data-panel="speed" aria-label="How fast is the sand moving?">`
    + phead('speed', 'How fast is the sand moving?', summary)
    + `<div class="ds-pbody"><div><p class="ds-lead">${lead}</p>${range}<div class="ds-divider"></div>${conf}<div class="ds-divider"></div>${dunes}<div class="ds-divider"></div>${risk}${callout}`
    + srcLine(esc(x.sources), 'uncertainty') + details('speed', det) + `</div></div></section>`;
}

/** The wind panel's lead sentence, from how far apart the measured heading and the MERRA-2 drift direction are. */
function windLead(w) {
  if (!isNum(w.apartDeg)) return 'The wind or the measured dune heading is missing for this site.';
  const wind = `toward the ${esc(w.rddName)} (${w.rddDeg}°)`, dunes = `toward the ${esc(w.duneName)} (${w.duneDeg}°)`;
  if (w.apartDeg <= 20) return `Wind pushes sand ${wind}, and the dunes move the same way, ${dunes}: <strong>${w.apartDeg}° apart</strong>.`;
  if (w.apartDeg <= 45) return `Wind pushes sand ${wind}; the dunes move ${dunes}, <strong>${w.apartDeg}° apart</strong>: close, but not the same.`;
  return `Wind pushes sand ${esc(w.rddName)}, but the dunes are moving ${esc(w.duneName)}, <strong>${w.apartDeg}° apart</strong>.`;
}

function windPanel(d) {
  const w = d.wind;
  const station = isNum(w.stationDeg)
    ? `<p class="ds-small ds-station" style="margin-top:8px">A ground station, ${esc(w.stationName)}, puts the push toward ${w.stationDeg}° ${compassName(w.stationDeg)}${isNum(w.stationApartDeg) ? `, ${w.stationApartDeg}° from the dunes` : ''}. MERRA-2 stays the main wind figure.</p>`
    : '';
  const det = dl([
    ['Shaded petals', 'Wind blowing from each direction; a larger petal means more sand-moving energy (drift potential).'],
    ['Net drift', `RDP ${n(w.rdp, 1)} VU/yr · RDP/DP ${n(w.rdpRatio, 2)}`],
    isNum(w.duneDeg) ? ['Dune heading', `${w.duneDeg}°: ${esc(w.duneLabel)}.${isNum(w.arrowMeanDeg) && w.arrowMeanDeg !== w.duneDeg ? ` The ${n(w.nArrows)} arrows drawn on the map (one per 240 m) average ${w.arrowMeanDeg}°, a different average of the same field.` : ''}`] : null,
    w.station ? ['Ground station', `${esc(w.station)}. ${w.stationNote ? esc(w.stationNote) : ''} <button type="button" class="ds-link" data-dossier="station">Its limits</button>`] : null,
    w.note ? ['Pipeline note', esc(w.note)] : null,
    ['Wind data', `${esc(w.source)}${w.period ? `, ${esc(w.period)}` : ''}${isNum(w.threshold) ? `; threshold ${w.threshold} kt` : ''}. A ~0.5° × 0.625° reanalysis: absolute DP is approximate, the direction is the more robust figure.`],
  ]) + `<button type="button" class="ds-more" data-action="method">Method ${icon('arrow', 14)}</button>`;
  return `<section class="ds-panel ds-panel--wind" data-panel="wind" aria-label="Why this direction?">`
    + phead('wind', 'Why this direction?', isNum(w.apartDeg) ? `${w.apartDeg}° apart` : 'no heading')
    + `<div class="ds-pbody"><div><p class="ds-lead" data-wind-lead>${windLead(w)}</p>${station}`
    + compassSVG(w)
    + `<p style="margin-top:6px">Wind energy: <strong>${esc(w.energy || '–')}</strong> (DP ${n(w.dp, 1)} VU/yr).</p>`
    + srcLine(esc(w.sources), isNum(w.stationDeg) ? 'station' : 'method') + details('wind', det) + `</div></div></section>`;
}

const STATUS_SWATCH = { now: COL.now, by2050: COL.by2050, by2100: COL.by2100, possible: COL.possible, none: COL.none };

function reachedPanel(d, filter) {
  const typeLabel = { road: 'Road', farm: 'Farm', building: 'Built-up' };
  const list = d.reached.filter((r) => filter === 'all' || r.type === filter);
  const chips = [['all', 'All'], ['road', 'Roads'], ['farm', 'Farms'], ['building', 'Built-up']]
    .map(([k, l]) => `<button type="button" data-rfilter="${k}" aria-pressed="${k === filter}">${l}</button>`).join('');
  const items = list.map((r) => {
    const sw = STATUS_SWATCH[STATUS_KEY[r.status]] || COL.none;
    return `<li><button type="button" data-target="${esc(r.id)}" title="${esc(r.name)}"><i style="background:${sw}"></i><b>${r.min}</b><span class="ds-rname">${esc(r.name)}</span>`
      + `<small>${typeLabel[r.type] || esc(r.type)} · ${r.min}–${isNum(r.max) ? r.max : 'after 2100'}${isNum(r.med) ? ` (median ${r.med})` : ''}${isNum(r.gap) ? ` · gap ${n(r.gap, 1)} m` : ''}</small></button></li>`;
  }).join('');
  return `<section class="ds-panel ds-panel--reached" data-panel="reached" aria-label="Which places does the sand reach first?">`
    + phead('reached', 'Which places does the sand reach first?', `${d.reached.length} by 2100`)
    + `<div class="ds-pbody"><div><p class="ds-lead"><strong>${n(d.reached.length)}</strong> roads, farms and built-up areas are reached by 2100.</p>`
    + `<p class="ds-caption" style="margin-top:4px">Earliest fast-case reach year first (speed + 1σ), then smallest gap. Select one to fly there.</p>`
    + `<div class="ds-seg ds-seg--small" role="group" aria-label="Filter">${chips}</div>`
    + `<ol class="ds-rlist">${items}</ol>`
    + `<p class="ds-caption">${list.length} shown${d.possibleCount ? `; ${n(d.possibleCount)} more are possible within direction uncertainty (no year; dashed on the map)` : ''}.</p>`
    + `</div></div></section>`;
}

function legendRows(mode, d, layers, settings, projectedVisible) {
  const lrow = (id, sample, label, { count, sub } = {}) =>
    `<label class="ds-lrow"><input type="checkbox" data-layer="${id}"${layers[id] ? ' checked' : ''}><span>${sample}</span><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${count != null ? `<b>${count}</b>` : '<span></span>'}</label>`;
  const classes = `<div class="ds-classes">${['stable', 'slow', 'active', 'fast'].map((k) => `<div>${outlineSample(MAP_STYLE.dune[k], 22)}${k[0].toUpperCase() + k.slice(1)}</div>`).join('')}</div>`;
  const then = lrow('dunes2000', outlineSample(MAP_STYLE.dune2000), 'Then vs now: overlay Feb 2000 outlines (dotted)');
  const box = lrow('box', lineSample(MAP_STYLE.box), 'Study area', projectedVisible ? { sub: 'dashed stone edge in projected years' } : {});
  const a = d.arrows, f = settings.arrowFactor || 1, yrs = a.baseYears * f;
  const arrows = (label, sub) => lrow('vectors', arrowSample(), label, { sub })
    + `<div class="ds-lsub"><span class="ds-caption">Arrow length</span><div class="ds-seg ds-seg--small" role="group" aria-label="Arrow length scale">${[1, 2, 4].map((k) => `<button type="button" data-factor="${k}" aria-pressed="${k === f}" title="${a.baseYears * k} years of motion">×${k}</button>`).join('')}</div></div>`
    + `<p class="ds-caption ds-lnote">No arrow: below detection limit${isNum(a.detectionLimit) ? ` (&lt; ${n(a.detectionLimit, 2)} m/yr)` : ''} or not dune sand.</p>`;
  const armSub = `length = ${yrs} years of motion (1 m/yr → ${yrs} m); fainter = weaker match`;
  const projected = projectedVisible
    ? lrow('projected', '<span class="ds-hatch"></span>', 'Moving sand, <strong style="letter-spacing:.04em">PROJECTED</strong>', { sub: 'image tinted stone; stone tracks = shift since the last scene' })
    : '';
  const exposed = lrow('exposed', exposedSample(), 'Exposed to blowing sand today', { count: n(d.targets.exposed), sub: 'borders free sand; not forecast by this tool' });
  const dunesRow = (sub) => lrow('dunes', outlineSample(MAP_STYLE.dune.active), 'Large dunes (NASADEM outline)', { sub });
  if (mode === 'motion') {
    return arrows('Dune motion, measured', armSub)
      + dunesRow('shifted to Nov 2025 by the motion measured around them') + classes + then
      + projected + box;
  }
  if (mode === 'threat') {
    const L = d.targets.legend, T = MAP_STYLE.threat;
    const rule = settings.reachCase === 'median' ? 'median' : 'fast-case';
    return `<div class="ds-lgroup ds-caption"><span>Roads, farms and built-up areas</span><span>most urgent first</span></div>`
      + lrow('t_now', lineSample(T.now), 'Sand at edge now', { count: n(L.now) })
      + lrow('t_by2050', lineSample(T.by2050), 'Reached by 2050', { count: n(L.by2050) })
      + lrow('t_by2100', lineSample(T.by2100), 'Reached 2051–2100', { count: n(L.by2100) })
      + lrow('t_possible', lineSample(T.possible), 'Possible within direction uncertainty', { count: n(L.possible) })
      + lrow('t_none', lineSample(T.none), 'Not reached by 2100', { count: n(L.none) })
      + `<p class="ds-caption ds-lnote">Bright from their ${rule} reach year on the timeline, faint before.</p>`
      + exposed
      + `<div class="ds-lgroup ds-caption"><span>Dunes and place</span></div>`
      + arrows('Dune motion near reached places', `others dimmed; ${armSub}`)
      + dunesRow('dimmed in this view') + then + projected + box;
  }
  return `<div class="ds-lgroup ds-caption"><span>Satellite image only</span></div>` + box + projected
    + dunesRow('shifted to Nov 2025 by the motion measured around them') + then
    + arrows('Dune motion, measured', armSub)
    + lrow('targets', lineSample(MAP_STYLE.threat.now), 'Roads, farms, built-up by threat') + exposed;
}

function legendPanel() {
  const det = `<p class="ds-small" style="margin-top:8px">Lines on the map match these samples exactly. Dune outlines come from NASADEM (Feb 2000), shifted to their Nov 2025 position by the motion measured around them. Reach years use the case chosen in timeline settings. Targets: OpenStreetMap roads and built-up areas; farms are HLS vegetated outlines.</p>`;
  return `<section class="ds-panel ds-panel--legend" data-panel="legend" aria-label="What's on the map?">`
    + phead('legend', 'What’s on the map?', '<span data-modename></span> layers')
    + `<div class="ds-pbody"><div><div data-legend-rows></div>${details('legend', det)}</div></div></section>`;
}

function cardPanel(card) {
  if (!card) return '';
  return `<section class="ds-panel ds-panel--card" data-panel="card" data-kind="${esc(card.kind || '')}" aria-label="Selected">`
    + `<div class="ds-phead"><h2>${card.title}</h2><button type="button" class="ds-icon-btn" data-action="clearSelection" aria-label="Clear selection (Esc)" title="Clear selection (Esc)">${icon('close')}</button></div>`
    + `<div class="ds-card-body">${card.tag ? `<div class="ds-card-tag">${card.tag}</div>` : ''}${card.html}<p class="ds-src ds-caption">Source: ${card.source} · <button type="button" class="ds-link" data-dossier="sources">sources</button></p></div></section>`;
}

// ---------- timeline ----------
function timelineSection(d, settings) {
  const tl = d.timeline, start = tl.start, end = tl.end, last = tl.lastObserved;
  const x = (y) => `${((y - start) / (end - start)) * 100}%`;
  const scenes = tl.scenes;
  let obs = '';
  // solid segments only between scenes in consecutive years: every gap stays a gap
  for (let i = 0; i < scenes.length - 1; i++) {
    const a = scenes[i], b = scenes[i + 1];
    if (b - a !== 1) continue;
    obs += `<div class="ds-track__obs" style="left:${x(a)};width:calc(${x(b)} - ${x(a)})"></div>`;
  }
  const gapEls = tl.gaps.map(([ga, gb]) => {
    const a = ga - 1, b = gb + 1, span = gb === ga ? `${ga}` : `${ga}–${gb}`;
    const long = gb - ga >= 2;
    return `<div class="ds-track__gap${long ? '' : ' ds-track__gap--short'}" style="left:${x(a)};width:calc(${x(b)} - ${x(a)})" title="No usable November Landsat scene ${span}: a gap, not interpolated">`
      + (long ? `no scenes<span class="ds-track__gap-long"> ${span}</span>` : `<span class="ds-sr">no scene ${span}</span>`) + '</div>';
  }).join('');
  const afterGaps = tl.gaps.filter(([ga, gb]) => gb - ga >= 2).map(([, gb]) => gb + 1);
  const years = [[start, 'first'], ...afterGaps.map((y) => [y, 'major']), [last, 'major'], ...tl.frames.filter((f) => f < end).map((f) => [f, (f - start) % 20 ? 'minor' : 'major']), [end, 'last']]
    .filter(([y], i, arr) => isNum(y) && arr.findIndex(([z]) => z === y) === i)
    .map(([y, k]) => `<div class="ds-track__year ds-track__year--${k}" style="left:${x(y)}">${y}</div>`).join('');
  return `<section class="ds-timeline" aria-label="When?">
  <div class="ds-tl-controls"><h2>When?</h2><div>
    <button type="button" class="ds-tbtn" data-step="-1" aria-label="Step back">${icon('back')}</button>
    <button type="button" class="ds-tbtn ds-tbtn--play" data-play aria-label="Play">${icon('play')}</button>
    <button type="button" class="ds-tbtn" data-step="1" aria-label="Step forward">${icon('fwd')}</button>
  </div></div>
  <div class="ds-tl-main">
    <div class="ds-track" role="slider" tabindex="0" aria-label="Year" aria-valuemin="${start}" aria-valuemax="${end}" aria-valuenow="${last}">
      <div class="ds-track__sect ds-track__sect--m" style="left:${x(last)}">Measured</div>
      <div class="ds-track__sect ds-track__sect--p" style="left:${x(last)}">Projected</div>
      ${obs}${gapEls}
      ${scenes.map((s) => `<div class="ds-track__scene" data-scene="${s}" style="left:${x(s)}"></div>`).join('')}
      <div class="ds-track__proj" style="left:${x(last)};right:0"></div>
      ${tl.frames.map((f) => `<div class="ds-track__frame" data-frame="${f}" style="left:${x(f)}"></div>`).join('')}
      <div class="ds-track__divider" style="left:${x(last)}"></div>
      ${years}
      <div class="ds-head" data-head><span data-head-label></span></div>
    </div>
    <div class="ds-tl-read"><p data-readout aria-live="polite"></p>
      <span class="ds-hint"><kbd>Space</kbd> play · <kbd>← →</kbd> step</span></div>
  </div>
  <div class="ds-gearwrap">
    <button type="button" class="ds-tbtn" data-gear aria-label="Timeline settings" aria-expanded="false">${icon('gear', 18)}</button>
    <div class="ds-pop" role="dialog" aria-label="Timeline settings" hidden>
      <h3>Timeline settings</h3>
      <label class="ds-block ds-small">Reach year on targets
        <select data-setting="reachCase"><option value="fast"${settings.reachCase === 'fast' ? ' selected' : ''}>Fast case (speed + 1σ)</option><option value="median"${settings.reachCase === 'median' ? ' selected' : ''}>Median case</option></select></label>
      <label><input type="checkbox" data-setting="fastCaseFrame"${settings.fastCaseFrame ? ' checked' : ''}> Show fast-case frame (faint, on top)</label>
      <label><input type="checkbox" data-setting="changedPixels"${settings.changedPixels ? ' checked' : ''}> Show changed pixels <span class="ds-caption">(&gt; 10 grey levels vs the last scene)</span></label>
      <button type="button" class="ds-more" data-action="readingNote">How to read the projection ${icon('arrow', 14)}</button>
    </div>
  </div>
</section>`;
}

// ---------- mount ----------
export function mountDuneSightUI(container, opts) {
  const o = { sites: [], mode: 'motion', ...opts };
  const state = {
    data: o.data, siteId: o.siteId || o.data.id, mode: o.mode,
    year: o.year ?? o.data.timeline.lastObserved, playing: false, timer: null,
    layers: structuredClone(DEFAULT_LAYERS), settings: { reachCase: 'fast', fastCaseFrame: true, changedPixels: false, arrowFactor: o.data.arrows?.factor || 1 },
    tab: 'speed', card: null, rfilter: 'all', topDown: false, basemap: '', sheetMin: false,
  };
  const root = document.createElement('div');
  root.className = 'ds-ui';
  container.appendChild(root);
  const call = (name, ...args) => typeof o[name] === 'function' && o[name](...args);

  function steps() {
    const tl = state.data.timeline, out = [...tl.scenes];
    for (let y = tl.lastObserved + 1; y <= tl.end; y++) out.push(y);
    return out;
  }
  const tabsFor = () => [['speed', 'Speed'], state.mode === 'threat' ? ['reached', 'Reached'] : ['wind', 'Wind'], ['key', 'Map key'], ['time', 'Time'], ...(state.card ? [['card', 'Selected']] : [])];

  function creditsText() {
    const c = state.data.credits || {};
    return [
      c.nasa?.length ? `Data and imagery: NASA (${c.nasa.map(esc).join(', ')})` : '',
      c.other?.length ? `Also: ${c.other.map(esc).join(', ')} (not NASA)` : '',
      c.osm ? '© OpenStreetMap contributors' : '',
      state.basemap ? `Basemap: ${esc(state.basemap)}` : '',
    ].filter(Boolean).join(' · ');
  }

  function render() {
    const d = state.data;
    const siteBtns = o.sites.map((s) => `<button type="button" data-site="${esc(s.id)}" aria-pressed="${s.id === state.siteId}">${esc(s.name)}</button>`).join('');
    const siteOpts = o.sites.map((s) => `<option value="${esc(s.id)}"${s.id === state.siteId ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
    const names = o.sites.map((s) => esc(s.name));
    const siteList = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] || '';
    root.innerHTML = `
<header class="ds-header">
  <div class="ds-brand">${icon('logo', 22, 1.75)}<div><b>DuneSight</b><span>Sand dune motion, UAE</span></div></div>
  <div class="ds-seg ds-seg--site" role="group" aria-label="Site">${siteBtns}<span class="ds-guide-dot" style="left:-12px;top:-10px">1</span></div>
  <label class="ds-site-select"><span class="ds-sr">Site</span><select data-site-select style="width:100%;height:100%;background:transparent;border:0">${siteOpts}</select></label>
  ${d.placeholder ? `<span class="ds-tag-warn" title="Placeholder files for this site: ${esc(d.placeholderFiles.join(', ') || 'see sites.json')}">placeholder data</span>` : ''}
  <div class="ds-seg ds-seg--mode" role="group" aria-label="View">${Object.keys(NAMES).map((m) => `<button type="button" data-mode="${m}" aria-pressed="${m === state.mode}">${NAMES[m]}</button>`).join('')}</div>
  <div class="ds-when" data-when aria-live="polite"></div>
  <div class="ds-spacer"></div>
  <button type="button" class="ds-ghost" data-action="home">${icon('home')}<span>Home</span></button>
  <button type="button" class="ds-ghost" data-action="topDown" aria-pressed="${state.topDown}">${icon('topdown')}<span>Top-down</span></button>
  <button type="button" class="ds-ghost ds-howbtn" data-action="howWeKnow" aria-label="How we know">${icon('book')}<span>How we know</span></button>
</header>
<div class="ds-sheet">
  <button type="button" class="ds-sheet-handle" data-sheet-toggle aria-label="Show or hide the panels" aria-expanded="${!state.sheetMin}"></button>
  <div class="ds-tabs" role="tablist" aria-label="Panels" data-tabs></div>
  ${speedPanel(d)}
  <div class="ds-right">${windPanel(d)}<div data-reached-slot></div>${legendPanel()}</div>
  <div data-card-slot></div>
  ${timelineSection(d, state.settings)}
</div>
<footer class="ds-footer"><span class="ds-credit-line">${esc(o.credit || '')}</span><span class="ds-credit-data" title="${esc(d.credits?.full || '')}">${creditsText()}</span><button type="button" data-dossier="credits">All credits</button><span class="ds-cesium-credits" data-cesium-credits></span></footer>
<div class="ds-guide-backdrop"></div>
<div class="ds-guide" role="dialog" aria-label="Getting started">
  <div class="ds-guide__top"><h2>New here? Three steps.</h2><button type="button" class="ds-icon-btn" data-guide-close aria-label="Close guide">${icon('close')}</button></div>
  <ol>
    <li><span class="ds-num">1</span><div><b>Pick a site</b><span class="ds-small">${siteList}, in the top bar.</span></div></li>
    <li><span class="ds-num">2</span><div><b>Read the speed</b><span class="ds-small">The left panel says how fast the sand moves and how sure we are.</span></div></li>
    <li><span class="ds-num">3</span><div><b>Press play to see the future</b><span class="ds-small">Measured years first, then projected years to 2050.</span></div></li>
  </ol>
  <div class="ds-guide__foot"><span class="ds-caption">You won’t see this again. Reopen it from How we know.</span><button type="button" class="ds-primary" data-guide-close>Start exploring</button></div>
</div>
<span class="ds-guide-dot" style="left:calc(var(--ds-gap-edge) + var(--ds-panel-left) - 12px);top:calc(var(--ds-header-h) + 4px)">2</span>
<span class="ds-guide-dot" style="left:calc(var(--ds-gap-edge) + 88px);bottom:calc(var(--ds-footer-h) + 60px)">3</span>`;
    root.dataset.mode = state.mode;
    root.dataset.sheet = state.sheetMin ? 'min' : 'full';
    if (state.guideOpen === undefined) state.guideOpen = !store.get('dunesight-guide-seen');
    root.dataset.guide = String(state.guideOpen);
    for (const k of ['speed', 'wind', 'legend']) setCollapsed(k, store.get(`dunesight-collapsed-${k}`) === '1', false);
    if (o.creditNode) root.querySelector('[data-cesium-credits]').appendChild(o.creditNode);
    renderTabs();
    renderReached();
    renderCard();
    renderLegend();
    renderTime();
  }

  function renderTabs() {
    const tabs = tabsFor();
    if (!tabs.some(([k]) => k === state.tab)) state.tab = 'speed';
    root.dataset.tab = state.tab;
    root.querySelector('[data-tabs]').innerHTML = tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === state.tab}">${l}</button>`).join('');
  }
  function renderReached() {
    root.querySelector('[data-reached-slot]').outerHTML = `<div data-reached-slot>${reachedPanel(state.data, state.rfilter)}</div>`;
    const k = 'reached';
    setCollapsed(k, store.get(`dunesight-collapsed-${k}`) === '1', false);
  }
  function renderCard() {
    root.querySelector('[data-card-slot]').innerHTML = cardPanel(state.card);
  }

  function setCollapsed(key, collapsed, save = true) {
    const p = root.querySelector(`[data-panel="${key}"]`);
    if (!p) return;
    p.dataset.collapsed = String(collapsed);
    p.querySelector('[data-collapse]').setAttribute('aria-expanded', String(!collapsed));
    if (save) store.set(`dunesight-collapsed-${key}`, collapsed ? '1' : '0');
  }

  function renderLegend() {
    const projectedVisible = state.year > state.data.timeline.lastObserved;
    root.querySelector('[data-legend-rows]').innerHTML = legendRows(state.mode, state.data, state.layers[state.mode], state.settings, projectedVisible);
    root.querySelector('[data-modename]').textContent = NAMES[state.mode];
  }

  function frameFor(y) {
    const fr = state.data.timeline.frames.filter((f) => f <= y);
    return fr.length ? Math.max(...fr) : null;
  }

  function renderTime() {
    const tl = state.data.timeline, y = state.year;
    const head = root.querySelector('[data-head]');
    head.style.left = `${((y - tl.start) / (tl.end - tl.start)) * 100}%`;
    root.querySelector('[data-head-label]').textContent = y;
    const track = root.querySelector('.ds-track');
    track.setAttribute('aria-valuenow', y);
    track.setAttribute('aria-valuetext', `${y} ${y > tl.lastObserved ? 'projected' : 'measured'}`);
    let text;
    const projected = y > tl.lastObserved;
    if (!projected) {
      const o2 = tl.observed[y];
      if (o2) {
        text = `<b>${y}</b> · ${measTag}${[
          o2.date ? `<b>${esc(o2.date)}</b>` : null,
          o2.sensor ? esc(o2.sensor) : null,
          isNum(o2.pixel) ? `${o2.pixel} m pixel` : null,
          o2.sceneId ? `scene <span class="ds-mono">${esc(o2.sceneId)}</span>` : null,
          isNum(o2.sunElev) ? `sun elevation ${n(o2.sunElev, 1)}°` : null,
        ].filter(Boolean).join(' · ')}`;
      } else {
        const g = tl.gaps.find(([a, b]) => y >= a && y <= b);
        text = `<b>${y}</b> · No satellite scene${g && g[1] > g[0] ? `s ${g[0]}–${g[1]}` : ''}. Nothing is drawn for this year.`;
      }
    } else {
      const f = frameFor(y), fd = f && tl.frameData?.[f];
      const lastDate = tl.observed[tl.lastObserved]?.date || `Nov ${tl.lastObserved}`;
      const fast = state.settings.fastCaseFrame ? ' Fast case drawn faint on top.' : '';
      if (!f) text = `<b>${y}</b> · ${projTag}Still showing the ${esc(lastDate)} scene; the first projected frame is ${tl.frames[0]}. Stone tracks on the arrows show the shift since then at the measured speed (${y - tl.lastObserved} yr).`;
      else {
        const nums = fd ? ` By ${f}, moving sand shifts a median <b>${n(fd.median, 1)} m</b> from ${esc(fd.fromDate || lastDate)} (p90 ${n(fd.p90, 1)} m${isNum(fd.max) ? `, max ${n(fd.max, 1)} m` : ''}); ${n(fd.areaPct, 1)}% of the box moving.` : '';
        text = `<b>${y}</b> · ${projTag}median case, ${f === y ? `the ${f} frame` : `shows the ${f} frame`}.${nums}${fast}`;
      }
    }
    root.querySelector('[data-readout]').innerHTML = text;
    root.querySelector('[data-when]').innerHTML = projected ? `${projTag}<b>${y}</b>` : `${measTag}<b>${y}</b>`;
    root.querySelector('[data-when]').dataset.kind = projected ? 'projected' : 'observed';
    const wasProjected = root.querySelector('[data-layer="projected"]') != null;
    if (wasProjected !== projected) renderLegend();
    declutterTrack(track, (y - tl.start) / (tl.end - tl.start));
  }

  /** Hide a "Measured" / "Projected" section label while the year head's label would sit on top of it. */
  function declutterTrack(track, frac) {
    const w = track.clientWidth, label = root.querySelector('[data-head-label]');
    if (!w || !label) return;
    const hx = frac * w, hw = label.offsetWidth / 2 + 4;
    for (const el of track.querySelectorAll('.ds-track__sect')) {
      const x0 = el.offsetLeft - (el.classList.contains('ds-track__sect--m') ? el.offsetWidth : 0), x1 = x0 + el.offsetWidth;
      el.style.visibility = hx + hw > x0 && hx - hw < x1 ? 'hidden' : '';
    }
  }

  function setYear(y, emit = true) {
    const tl = state.data.timeline;
    state.year = Math.max(tl.start, Math.min(tl.end, y));
    renderTime();
    if (emit) call('onTimeChange', state.year, { projected: state.year > tl.lastObserved, frame: frameFor(state.year), observed: tl.scenes.includes(state.year) });
  }
  function step(dir) {
    const s = steps(), i = s.findIndex((v) => v >= state.year);
    let j = dir > 0 ? (s[i] === state.year ? i + 1 : i) : (i === -1 ? s.length - 1 : i - 1);
    j = Math.max(0, Math.min(s.length - 1, j));
    if (s[j] !== state.year) setYear(s[j]);
  }
  function setPlaying(on) {
    state.playing = on;
    clearInterval(state.timer);
    const btn = root.querySelector('[data-play]');
    btn.innerHTML = icon(on ? 'pause' : 'play');
    btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (!on) return;
    if (state.year >= state.data.timeline.end) setYear(state.data.timeline.start);
    state.timer = setInterval(() => {
      if (state.year >= state.data.timeline.end) return setPlaying(false);
      step(1);
    }, o.playIntervalMs || 600);
  }
  function setMode(m, emit = true) {
    state.mode = m;
    root.dataset.mode = m;
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    renderTabs();
    renderLegend();
    if (emit) {
      call('onModeChange', m);
      Object.entries(state.layers[m]).forEach(([id, on]) => call('onLayerToggle', id, on, m));
    }
  }
  function closeGuide() {
    store.set('dunesight-guide-seen', '1');
    state.guideOpen = false;
    root.dataset.guide = 'false';
  }

  // ---------- events (delegated) ----------
  root.addEventListener('click', (e) => {
    // buttons only: the root itself carries data-mode / data-tab, so a looser selector would match it
    const t = e.target.closest('button');
    if (!t || t === root || !root.contains(t)) return;
    if (t.dataset.mode) return setMode(t.dataset.mode);
    if (t.dataset.site) { state.siteId = t.dataset.site; root.querySelectorAll('[data-site]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return call('onSiteChange', t.dataset.site); }
    if (t.dataset.collapse) return setCollapsed(t.dataset.collapse, root.querySelector(`[data-panel="${t.dataset.collapse}"]`).dataset.collapsed !== 'true');
    if (t.dataset.details) {
      const box = root.querySelector(`#ds-det-${t.dataset.details}`), open = box.dataset.open !== 'true';
      box.dataset.open = String(open); t.setAttribute('aria-expanded', String(open)); return;
    }
    if (t.dataset.tab && t.getAttribute('role') === 'tab') {
      state.tab = t.dataset.tab; root.dataset.tab = state.tab;
      if (state.sheetMin) { state.sheetMin = false; root.dataset.sheet = 'full'; }
      root.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b === t))); return;
    }
    if (t.hasAttribute('data-sheet-toggle')) { state.sheetMin = !state.sheetMin; root.dataset.sheet = state.sheetMin ? 'min' : 'full'; t.setAttribute('aria-expanded', String(!state.sheetMin)); return; }
    if (t.hasAttribute('data-play')) return setPlaying(!state.playing);
    if (t.dataset.step) { setPlaying(false); return step(Number(t.dataset.step)); }
    if (t.dataset.factor) {
      state.settings.arrowFactor = Number(t.dataset.factor);
      renderLegend(); return call('onSettingChange', 'arrowFactor', state.settings.arrowFactor);
    }
    if (t.dataset.rfilter) { state.rfilter = t.dataset.rfilter; return renderReached(); }
    if (t.dataset.target) return call('onPickTarget', t.dataset.target);
    if (t.hasAttribute('data-gear')) {
      const pop = root.querySelector('.ds-pop'); pop.hidden = !pop.hidden; t.setAttribute('aria-expanded', String(!pop.hidden)); return;
    }
    if (t.hasAttribute('data-guide-close')) return closeGuide();
    if (t.dataset.action) call(`on${t.dataset.action[0].toUpperCase()}${t.dataset.action.slice(1)}`);
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.layer) { state.layers[state.mode][t.dataset.layer] = t.checked; return call('onLayerToggle', t.dataset.layer, t.checked, state.mode); }
    if (t.dataset.setting) {
      state.settings[t.dataset.setting] = t.type === 'checkbox' ? t.checked : t.value;
      renderTime();
      if (t.dataset.setting === 'reachCase') renderLegend();
      return call('onSettingChange', t.dataset.setting, state.settings[t.dataset.setting]);
    }
    if (t.hasAttribute('data-site-select')) { state.siteId = t.value; call('onSiteChange', t.value); }
  });
  // drag or click on the track to seek
  root.addEventListener('pointerdown', (e) => {
    const track = e.target.closest('.ds-track');
    if (!track) return;
    setPlaying(false);
    const seek = (ev) => {
      const r = track.getBoundingClientRect(), tl = state.data.timeline;
      const y = tl.start + Math.round(((ev.clientX - r.left) / r.width) * (tl.end - tl.start));
      const s = steps(), near = s.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
      if (near !== state.year) setYear(near);
    };
    seek(e);
    track.setPointerCapture(e.pointerId);
    const up = () => { track.removeEventListener('pointermove', seek); track.removeEventListener('pointerup', up); };
    track.addEventListener('pointermove', seek);
    track.addEventListener('pointerup', up);
  });
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (o.keyGuard?.()) return; // e.g. the dossier dialog is open
    if (e.code === 'Space') {
      if (e.target.closest('button, a')) return; // Space activates the focused control
      e.preventDefault(); setPlaying(!state.playing);
    }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); step(-1); }
    else if (e.key === 'Escape') { const pop = root.querySelector('.ds-pop'); if (pop && !pop.hidden) pop.hidden = true; }
  };
  document.addEventListener('keydown', onKey);

  render();

  // ---------- public API ----------
  return {
    root,
    /** New site data: re-renders every panel; the timeline returns to the site's latest scene and the arrow scale to its default. */
    setData(data) {
      setPlaying(false);
      state.data = data;
      state.siteId = data.id;
      state.year = data.timeline.lastObserved;
      state.settings.arrowFactor = data.arrows?.factor || 1;
      state.rfilter = 'all';
      render();
    },
    setMode: (m) => setMode(m, false),
    setYear: (y) => setYear(y, false),
    /** Go to a timeline stop (an observed scene or a projected year) and tell the app; false if the year is not a stop. */
    goYear(y) {
      if (!steps().includes(y)) return false;
      setPlaying(false);
      setYear(y);
      return true;
    },
    steps,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    togglePlay: () => setPlaying(!state.playing),
    showGuide: () => { state.guideOpen = true; root.dataset.guide = 'true'; },
    setCard(card) {
      const had = !!state.card;
      state.card = card;
      if (card && !had) state.tab = 'card';
      if (!card && state.tab === 'card') state.tab = 'speed';
      renderTabs();
      renderCard();
    },
    setTopDown(v) { state.topDown = v; root.querySelector('[data-action="topDown"]')?.setAttribute('aria-pressed', String(v)); },
    setLoading(siteId, loading) { root.querySelector(`[data-site="${CSS.escape(siteId)}"]`)?.setAttribute('aria-busy', String(loading)); },
    setBasemap(text) { state.basemap = text || ''; const el = root.querySelector('.ds-credit-data'); if (el) el.innerHTML = creditsText(); },
    getState: () => ({ mode: state.mode, year: state.year, playing: state.playing, layers: structuredClone(state.layers[state.mode]), settings: { ...state.settings }, siteId: state.siteId, tab: state.tab }),
    destroy() { setPlaying(false); document.removeEventListener('keydown', onKey); root.remove(); },
  };
}
