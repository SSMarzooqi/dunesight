// DuneSight UI: header, 4 panels, timeline, legend, first-visit guide, mobile sheet.
// Plain JS, no framework. Usage:
//   import { mountDuneSightUI } from './ui/ui.js';
//   const ui = mountDuneSightUI(document.getElementById('app'), { data, sites, onModeChange, ... });
// The container must be position: relative (or fixed) and cover the Cesium viewer.

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
  casing: COL.casing, // draw under every line at width + 2
};

const NAMES = { true: 'True view', motion: 'Motion', threat: 'Threat' };
const DEFAULT_LAYERS = {
  true: { box: true, dunes: false, vectors: false, targets: false },
  motion: { vectors: true, dunes: true, dunes2000: false, projected: true, box: true },
  threat: { t_now: true, t_by2050: true, t_by2100: true, t_possible: true, t_none: true, dunes: true, dunes2000: false, box: true },
};

// ---------- small helpers ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
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

const compassName = (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
const projTag = '<span class="ds-tag-projected">PROJECTED</span>';

// ---------- compass ----------
function compassSVG(w) {
  const W = 300, H = 196, cx = 150, cy = 98, R = 72;
  const P = (b, r, x = cx, y = cy) => [x + r * Math.sin(b * Math.PI / 180), y - r * Math.cos(b * Math.PI / 180)];
  const f = (v) => v.toFixed(1);
  let s = `<svg class="ds-compass" viewBox="0 0 ${W} ${H}" role="img" aria-label="Compass. Wind pushes sand toward ${w.rddDeg} degrees. Dunes measured moving toward ${w.duneDeg} degrees. ${w.apartDeg} degrees apart.${w.stationDeg != null ? ` Ground station toward ${w.stationDeg} degrees.` : ''}">`;
  const rose = w.rose || [];
  const maxV = Math.max(...rose, 1e-9);
  rose.forEach((v, i) => {
    const b = i * (360 / rose.length), r = R * 0.92 * Math.sqrt(v / maxV), half = 360 / rose.length / 2 - 1.75;
    const [x1, y1] = P(b - half, r), [x2, y2] = P(b + half, r);
    s += `<path d="M${cx} ${cy} L${f(x1)} ${f(y1)} A${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(y2)} Z" fill="rgba(237,230,216,0.13)" stroke="rgba(237,230,216,0.22)" stroke-width="0.75"/>`;
  });
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(237,230,216,0.30)"/><circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="rgba(237,230,216,0.12)"/>`;
  for (let b = 0; b < 360; b += 30) {
    const [x1, y1] = P(b, R), [x2, y2] = P(b, R - (b % 90 ? 4 : 7));
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="rgba(237,230,216,0.45)"/>`;
  }
  s += `<text x="${cx - 9}" y="${cy - R + 21}" text-anchor="middle" font-size="12" font-weight="600" fill="${COL.text2}" stroke="${COL.panel}" stroke-width="3" paint-order="stroke">N</text>`;
  // arc between dunes and wind
  let a0 = w.duneDeg, a1 = w.rddDeg, diff = ((a1 - a0) % 360 + 360) % 360;
  if (diff > 180) { [a0, a1] = [a1, a0]; diff = 360 - diff; }
  const [ax, ay] = P(a0, 40), [bx, by] = P(a1, 40);
  s += `<path d="M${f(ax)} ${f(ay)} A40 40 0 0 1 ${f(bx)} ${f(by)}" fill="none" stroke="${COL.text}"/>`;
  const arrow = (b, r, c, width, dash) => {
    const [tx, ty] = P(b, r), [hx, hy] = P(b, r - 9), [lx, ly] = P(b - 90, 4.2, hx, hy), [rx, ry] = P(b + 90, 4.2, hx, hy);
    return `<line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="${COL.panel}" stroke-width="${width + 2.5}" stroke-linecap="round"/>`
      + `<line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="${c}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
      + `<path d="M${f(tx)} ${f(ty)} L${f(lx)} ${f(ly)} L${f(rx)} ${f(ry)} Z" fill="${c}" stroke="${COL.panel}"/>`;
  };
  if (w.stationDeg != null) s += arrow(w.stationDeg, 64, COL.wind, 1.5, '4 3');
  s += arrow(w.rddDeg, R, COL.wind, 2.75) + arrow(w.duneDeg, R, COL.measured, 2.75);
  s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${COL.text}"/>`;
  const halo = `stroke="${COL.panel}" stroke-width="4" paint-order="stroke" stroke-linejoin="round"`;
  const label = (b, r, lines, color) => {
    const [x, y] = P(b, r), sn = Math.sin(b * Math.PI / 180), cs = Math.cos(b * Math.PI / 180);
    const anchor = sn > 0.25 ? 'start' : sn < -0.25 ? 'end' : 'middle';
    const y0 = cs > 0.5 ? y - (lines.length - 1) * 14 - 2 : cs < -0.5 ? y + 12 : y - (lines.length - 1) * 7 + 4;
    return lines.map((t, i) => `<text x="${f(x)}" y="${f(y0 + i * 14)}" text-anchor="${anchor}" font-size="12" font-weight="${i ? 400 : 600}" fill="${color}" ${halo}>${esc(t)}</text>`).join('');
  };
  const [gx, gy] = P(a0 + diff / 2, 55);
  s += `<text x="${f(gx)}" y="${f(gy + 4)}" text-anchor="middle" font-size="12" font-weight="600" fill="${COL.text}" ${halo}>${w.apartDeg}°</text>`;
  if (w.stationDeg != null) s += label(w.stationDeg, 74, [`Station ${w.stationDeg}° ${compassName(w.stationDeg)}`], COL.text2);
  s += label(w.duneDeg, R + 9, ['Dunes moving', `toward ${w.duneDeg}° ${compassName(w.duneDeg)}`], COL.measured);
  s += label(w.rddDeg, R + 9, ['Wind push', `toward ${w.rddDeg}° ${compassName(w.rddDeg)}`], COL.text);
  return s + '</svg>';
}

// ---------- panels ----------
function phead(key, title, summary) {
  return `<div class="ds-phead"><h2>${title}<span class="ds-sum"> · ${summary}</span></h2>`
    + `<button type="button" class="ds-icon-btn" data-collapse="${key}" aria-label="Collapse or expand: ${title}" aria-expanded="true">${icon('chevUp')}</button></div>`;
}
function details(key, inner) {
  return `<button type="button" class="ds-dtoggle" data-details="${key}" aria-expanded="false"><span>Details</span>${icon('chevDown')}</button>`
    + `<div class="ds-details" data-open="false" id="ds-det-${key}"><div>${inner}</div></div>`;
}
const dl = (rows) => `<dl class="ds-dl">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

function speedPanel(d) {
  const s = d.speed, max = s.axisMax || 1.5, pc = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const lim = s.detectionLimit;
  const below = s.median == null || s.median < lim;
  const lead = below
    ? `Sand here moves too slowly to measure: <strong>below detection limit (&lt; ${lim} m/yr)</strong>.`
    : `Sand here moves about <strong>${n(s.median, 2)} m a year</strong>, toward the ${esc(s.headingName)} (${s.headingDeg}°).`;
  const range = `<div class="ds-range" role="img" aria-label="Median ${s.median} m per year. Most moving sand ${s.p10} to ${s.p90}. Below ${lim} is too slow to detect.">`
    + (below ? '' : `<div class="ds-range__median" style="left:${pc(s.median)}">Median ${n(s.median, 2)}</div>`)
    + `<div class="ds-range__track"></div><div class="ds-range__below" style="width:${pc(lim)}"></div>`
    + `<div class="ds-range__band" style="left:${pc(s.p10)};width:calc(${pc(s.p90)} - ${pc(s.p10)})"></div>`
    + (below ? '' : `<div class="ds-range__tick" style="left:${pc(s.median)}"></div>`)
    + `<div class="ds-range__lbl" style="left:0">Too slow to detect (&lt; ${lim})</div>`
    + `<div class="ds-range__lbl" style="left:${pc(1)};transform:translateX(-50%)">1.0</div>`
    + `<div class="ds-range__lbl" style="right:0">${n(max, 1)} m/yr</div>`
    + `<div class="ds-range__key ds-small"><i class="ds-swatch-band"></i>Most moving sand: ${n(s.p10, 2)}–${n(s.p90, 2)} m/yr (10–90%)</div></div>`;
  const conf = `<div class="ds-conf">${['speed', 'heading'].map((k) => {
    const c = d.confidence[k];
    return `<p class="ds-small">${statusMark(c.status)}<span><b>${k === 'speed' ? 'Speed' : 'Heading'}: ${STATUS_TEXT[c.status]}.</b> ${esc(c.text)}</span></p>`;
  }).join('')}</div>`;
  const du = d.dunes, th = du.thresholds;
  const classes = [['stable', 'Stable', 'below limit'], ['slow', 'Slow', `&lt; ${th.slow}`], ['active', 'Active', `&lt; ${th.active}`], ['fast', 'Fast', `≥ ${th.active}`]];
  const dunes = `<h3 class="ds-h3">${du.total} large dunes <span>· speed in m/yr</span></h3>`
    + `<div class="ds-stack" role="img" aria-label="${classes.map(([k, l]) => `${du[k]} ${l}`).join(', ')}">${classes.filter(([k]) => du[k] > 0).map(([k]) => `<span style="flex:${du[k]} 1 0;background:${COL[k]}"></span>`).join('')}</div>`
    + `<div class="ds-dkey">${classes.map(([k, l, t]) => `<div><div><i style="background:${COL[k]}"></i>${l} <strong>${du[k]}</strong></div><div class="ds-caption">${t}</div></div>`).join('')}</div>`;
  const t = d.targets;
  const row = (label, sw, r) => `<tr><th scope="row">${sw}${label}</th><td>${n(r.all)}</td><td>${n(r.roads)}</td><td>${n(r.farms)}</td><td>${n(r.built)}</td></tr>`;
  const risk = `<h3 class="ds-h3">At risk <span>· of ${n(t.total)} roads, farms, built-up areas</span></h3>`
    + `<table class="ds-table"><thead><tr><th scope="col"><span class="ds-sr">Status</span></th><th scope="col">All</th><th scope="col">Roads</th><th scope="col">Farms</th><th scope="col">Built-up</th></tr></thead><tbody>`
    + row('Sand at edge now', `<i style="background:${COL.now}"></i>`, t.edgeNow)
    + row('Reached by 2050*', `<i style="background:${COL.by2050};box-shadow:inset 5px 0 0 ${COL.now}"></i>`, t.by2050)
    + `</tbody></table><p class="ds-caption" style="margin-top:4px">*Includes edge-now; fast-case reach year (speed + 1σ).</p>`;
  const p = d.projection2050;
  const callout = p ? `<div class="ds-callout"><p>${projTag}By 2050, moving sand shifts a median <strong>${n(p.median, 1)} m</strong> (p90 ${n(p.p90, 1)} m); <strong>${n(p.areaPct, 1)}%</strong> of the area moves.</p></div>` : '';
  const x = d.details;
  const det = dl([
    ['Motion found', `${x.windowsPct}% of ${n(x.windows)} dune windows (${esc(x.windowSize)}) show motion. The rest are below the detection limit (&lt; ${lim} m/yr).`],
    ['Baseline', `${esc(x.baseline)}, ±${s.sigma} m/yr (1σ)`],
    ['Dune outlines', esc(x.outlines)],
    ['Sources', esc(x.sources)],
  ]) + `<button type="button" class="ds-more" data-action="howWeKnow">How we know ${icon('arrow', 14)}</button>`;
  const summary = below ? `below detection limit` : `${n(s.median, 2)} m/yr, ${compassName(s.headingDeg)}`;
  return `<section class="ds-panel ds-panel--speed" data-panel="speed" aria-label="How fast is the sand moving?">`
    + phead('speed', 'How fast is the sand moving?', summary)
    + `<div class="ds-pbody"><div><p class="ds-lead">${lead}</p>${range}<div class="ds-divider"></div>${conf}<div class="ds-divider"></div>${dunes}<div class="ds-divider"></div>${risk}${callout}${details('speed', det)}</div></div></section>`;
}

function windPanel(d) {
  const w = d.wind;
  const det = dl([
    ['Shaded petals', 'Wind blowing from each direction; a larger petal means more sand-moving energy (drift potential).'],
    ['Net drift', `RDP ${n(w.rdp, 1)} VU/yr · RDP/DP ${n(w.rdpRatio, 2)}`],
    w.station ? ['Ground station', esc(w.station)] : null,
    w.note ? ['Why it matters', esc(w.note)] : null,
    ['Sources', esc(w.sources)],
  ]) + `<button type="button" class="ds-more" data-action="method">Method ${icon('arrow', 14)}</button>`;
  return `<section class="ds-panel ds-panel--wind" data-panel="wind" aria-label="Why this direction?">`
    + phead('wind', 'Why this direction?', `${w.apartDeg}° apart`)
    + `<div class="ds-pbody"><div><p class="ds-lead">Wind pushes sand ${esc(w.rddName)}, but the dunes are moving ${esc(w.duneName)}, <strong>${w.apartDeg}° apart</strong>.</p>`
    + compassSVG(w)
    + `<p style="margin-top:10px">Wind energy: <strong>${esc(w.energy)}</strong> (DP ${n(w.dp, 1)} VU/yr).</p>${details('wind', det)}</div></div></section>`;
}

function legendRows(mode, d, layers, projectedVisible) {
  const lrow = (id, sample, label, { count, sub } = {}) =>
    `<label class="ds-lrow"><input type="checkbox" data-layer="${id}"${layers[id] ? ' checked' : ''}><span>${sample}</span><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${count != null ? `<b>${count}</b>` : '<span></span>'}</label>`;
  const classes = `<div class="ds-classes">${['stable', 'slow', 'active', 'fast'].map((k) => `<div>${outlineSample(MAP_STYLE.dune[k], 22)}${k[0].toUpperCase() + k.slice(1)}</div>`).join('')}</div>`;
  const then = lrow('dunes2000', outlineSample(MAP_STYLE.dune2000), 'Then vs now: overlay Feb 2000 outlines (dotted)');
  const box = lrow('box', lineSample(MAP_STYLE.box), 'Study area');
  if (mode === 'motion') {
    return lrow('vectors', arrowSample(), 'Dune motion, measured', { sub: 'arrow length shows speed' })
      + lrow('dunes', outlineSample(MAP_STYLE.dune.active), 'Dune outlines, 2025 position') + classes + then
      + (projectedVisible ? lrow('projected', '<span class="ds-hatch"></span>', 'Moving sand, <strong style="letter-spacing:.04em">PROJECTED</strong>') : '')
      + box;
  }
  if (mode === 'threat') {
    const L = d.targets.legend, T = MAP_STYLE.threat;
    return `<div class="ds-lgroup ds-caption"><span>Roads, farms and built-up areas</span><span>most urgent first</span></div>`
      + lrow('t_now', lineSample(T.now), 'Sand at edge now', { count: n(L.now) })
      + lrow('t_by2050', lineSample(T.by2050), 'Reached by 2050', { count: n(L.by2050) })
      + lrow('t_by2100', lineSample(T.by2100), 'Reached 2051–2100', { count: n(L.by2100) })
      + lrow('t_possible', lineSample(T.possible), 'Possible within direction uncertainty', { count: n(L.possible) })
      + lrow('t_none', lineSample(T.none), 'Not reached by 2100', { count: n(L.none) })
      + `<div class="ds-lgroup ds-caption"><span>Dunes and place</span></div>`
      + lrow('dunes', outlineSample(MAP_STYLE.dune.stable), 'Dune outlines, 2025 position', { sub: 'dimmed in this view' }) + then + box;
  }
  return `<div class="ds-lgroup ds-caption"><span>Satellite image only</span></div>` + box
    + lrow('dunes', outlineSample(MAP_STYLE.dune.active), 'Dune outlines, 2025 position')
    + lrow('vectors', arrowSample(), 'Dune motion, measured')
    + lrow('targets', lineSample(MAP_STYLE.threat.now), 'Roads, farms, built-up by threat');
}

function legendPanel() {
  const det = `<p class="ds-small" style="margin-top:8px">Lines on the map match these samples exactly. Dune outlines come from NASADEM (Feb 2000), moved to their 2025 position. Reach years use the case chosen in timeline settings. Targets: OpenStreetMap and ESA WorldCover.</p>`;
  return `<section class="ds-panel ds-panel--legend" data-panel="legend" aria-label="What's on the map?">`
    + phead('legend', 'What’s on the map?', '<span data-modename></span> layers')
    + `<div class="ds-pbody"><div><div data-legend-rows></div>${details('legend', det)}</div></div></section>`;
}

// ---------- timeline ----------
function timelineSection(d) {
  const tl = d.timeline, start = tl.start, end = tl.end, last = tl.lastObserved;
  const x = (y) => `${((y - start) / (end - start)) * 100}%`;
  const scenes = tl.scenes;
  let obs = '';
  // solid segments between consecutive scenes unless they straddle the gap
  for (let i = 0; i < scenes.length - 1; i++) {
    const a = scenes[i], b = scenes[i + 1];
    if (tl.gap && a < tl.gap[0] && b > tl.gap[1]) continue;
    obs += `<div class="ds-track__obs" style="left:${x(a)};width:calc(${x(b)} - ${x(a)})"></div>`;
  }
  const gapEl = tl.gap ? (() => {
    const a = Math.max(...scenes.filter((s) => s < tl.gap[0])), b = Math.min(...scenes.filter((s) => s > tl.gap[1]));
    return `<div class="ds-track__gap" style="left:${x(a)};width:calc(${x(b)} - ${x(a)})">no scenes<span class="ds-track__gap-long"> ${tl.gap[0]}–${tl.gap[1]}</span></div>`;
  })() : '';
  const firstAfterGap = tl.gap ? Math.min(...scenes.filter((s) => s > tl.gap[1])) : null;
  const years = [[start, 'first'], [firstAfterGap, 'major'], [last, 'major'], ...tl.frames.filter((f) => f < end).map((f) => [f, (f - start) % 20 ? 'minor' : 'major']), [end, 'last']]
    .filter(([y]) => y != null)
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
      ${obs}${gapEl}
      ${scenes.map((s) => `<div class="ds-track__scene" style="left:${x(s)}"></div>`).join('')}
      <div class="ds-track__proj" style="left:${x(last)};right:0"></div>
      ${tl.frames.map((f) => `<div class="ds-track__frame" style="left:${x(f)}"></div>`).join('')}
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
        <select data-setting="reachCase"><option value="fast">Fast case (speed + 1σ)</option><option value="median">Median case</option></select></label>
      <label><input type="checkbox" data-setting="fastCaseFrame" checked> Show fast-case frame</label>
      <label><input type="checkbox" data-setting="changedPixels"> Show changed pixels</label>
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
    layers: structuredClone(DEFAULT_LAYERS), settings: { reachCase: 'fast', fastCaseFrame: true, changedPixels: false },
    tab: 'speed',
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

  function render() {
    const d = state.data;
    const siteBtns = o.sites.map((s) => `<button type="button" data-site="${s.id}" aria-pressed="${s.id === state.siteId}">${esc(s.name)}</button>`).join('');
    const siteOpts = o.sites.map((s) => `<option value="${s.id}"${s.id === state.siteId ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
    root.innerHTML = `
<header class="ds-header">
  <div class="ds-brand">${icon('logo', 22, 1.75)}<div><b>DuneSight</b><span>Sand dune motion, UAE</span></div></div>
  <div class="ds-seg ds-seg--site" role="group" aria-label="Site">${siteBtns}<span class="ds-guide-dot" style="left:-12px;top:-10px">1</span></div>
  <label class="ds-site-select"><span class="ds-sr">Site</span><select data-site-select style="width:100%;height:100%;background:transparent;border:0">${siteOpts}</select></label>
  <div class="ds-seg ds-seg--mode" role="group" aria-label="View">${Object.keys(NAMES).map((m) => `<button type="button" data-mode="${m}" aria-pressed="${m === state.mode}">${NAMES[m]}</button>`).join('')}</div>
  <div class="ds-spacer"></div>
  <button type="button" class="ds-ghost" data-action="home">${icon('home')}<span>Home</span></button>
  <button type="button" class="ds-ghost" data-action="topDown">${icon('topdown')}<span>Top-down</span></button>
  <button type="button" class="ds-ghost ds-howbtn" data-action="howWeKnow" aria-label="How we know">${icon('book')}<span>How we know</span></button>
</header>
<div class="ds-sheet">
  <div class="ds-tabs" role="tablist" aria-label="Panels">
    ${[['speed', 'Speed'], ['wind', 'Wind'], ['key', 'Map key'], ['time', 'Time']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === state.tab}">${l}</button>`).join('')}
  </div>
  ${speedPanel(d)}
  <div class="ds-right">${windPanel(d)}${legendPanel()}</div>
  ${timelineSection(d)}
</div>
<footer class="ds-footer"><span>${esc(o.credit || 'Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124 · Data: NASA, USGS, NOAA ·')}</span><button type="button" data-action="credits">All credits</button></footer>
<div class="ds-guide-backdrop"></div>
<div class="ds-guide" role="dialog" aria-label="Getting started">
  <div class="ds-guide__top"><h2>New here? Three steps.</h2><button type="button" class="ds-icon-btn" data-guide-close aria-label="Close guide">${icon('close')}</button></div>
  <ol>
    <li><span class="ds-num">1</span><div><b>Pick a site</b><span class="ds-small">Seih Al Hama, Sweihan or Liwa, in the top bar.</span></div></li>
    <li><span class="ds-num">2</span><div><b>Read the speed</b><span class="ds-small">The left panel says how fast the sand moves and how sure we are.</span></div></li>
    <li><span class="ds-num">3</span><div><b>Press play to see the future</b><span class="ds-small">Measured years first, then projected years to 2050.</span></div></li>
  </ol>
  <div class="ds-guide__foot"><span class="ds-caption">You won’t see this again. Reopen it from How we know.</span><button type="button" class="ds-primary" data-guide-close>Start exploring</button></div>
</div>
<span class="ds-guide-dot" style="left:calc(var(--ds-gap-edge) + var(--ds-panel-left) - 12px);top:calc(var(--ds-header-h) + 4px)">2</span>
<span class="ds-guide-dot" style="left:calc(var(--ds-gap-edge) + 88px);bottom:calc(var(--ds-footer-h) + 60px)">3</span>`;
    root.dataset.tab = state.tab;
    root.dataset.guide = store.get('dunesight-guide-seen') ? 'false' : 'true';
    for (const k of ['speed', 'wind', 'legend']) setCollapsed(k, store.get(`dunesight-collapsed-${k}`) === '1', false);
    renderLegend();
    renderTime();
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
    root.querySelector('[data-legend-rows]').innerHTML = legendRows(state.mode, state.data, state.layers[state.mode], projectedVisible);
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
    root.querySelector('.ds-track').setAttribute('aria-valuenow', y);
    const caseName = state.settings.reachCase === 'fast' ? 'fast case' : 'median case';
    let text;
    if (y <= tl.lastObserved) {
      text = tl.scenes.includes(y)
        ? `<b>${y}</b> · Measured · November ${y} Landsat scene.`
        : `<b>${y}</b> · No satellite scenes ${tl.gap[0]}–${tl.gap[1]}. Nothing is drawn for these years.`;
    } else {
      const f = frameFor(y), fd = f && tl.frameData?.[f];
      if (!f) text = `<b>${y}</b> · ${projTag}${caseName}. Still showing the Nov ${tl.lastObserved} scene; the first projected frame is ${tl.frames[0]}.`;
      else {
        const nums = fd ? ` By ${f}, sand moves a median <b>${n(fd.median, 1)} m</b> from Nov ${tl.lastObserved} (p90 ${n(fd.p90, 1)} m${fd.max != null ? `, max ${n(fd.max, 1)} m` : ''}); ${n(fd.areaPct, 1)}% of the area moving.` : '';
        text = `<b>${y}</b> · ${projTag}${caseName}, shows the ${f} frame.${nums}`;
      }
    }
    root.querySelector('[data-readout]').innerHTML = text;
    const wasProjected = root.querySelector('[data-layer="projected"]') != null;
    if (state.mode === 'motion' && wasProjected !== (y > tl.lastObserved)) renderLegend();
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
    setYear(s[j]);
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
    }, o.playIntervalMs || 700);
  }
  function setMode(m, emit = true) {
    state.mode = m;
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    renderLegend();
    if (emit) {
      call('onModeChange', m);
      Object.entries(state.layers[m]).forEach(([id, on]) => call('onLayerToggle', id, on, m));
    }
  }

  // ---------- events (delegated) ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-tab]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.mode) return setMode(t.dataset.mode);
    if (t.dataset.site) { state.siteId = t.dataset.site; root.querySelectorAll('[data-site]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return call('onSiteChange', t.dataset.site); }
    if (t.dataset.collapse) return setCollapsed(t.dataset.collapse, root.querySelector(`[data-panel="${t.dataset.collapse}"]`).dataset.collapsed !== 'true');
    if (t.dataset.details) {
      const box = root.querySelector(`#ds-det-${t.dataset.details}`), open = box.dataset.open !== 'true';
      box.dataset.open = String(open); t.setAttribute('aria-expanded', String(open)); return;
    }
    if (t.dataset.tab && t.getAttribute('role') === 'tab') {
      state.tab = t.dataset.tab; root.dataset.tab = state.tab;
      root.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b === t))); return;
    }
    if (t.hasAttribute('data-play')) return setPlaying(!state.playing);
    if (t.dataset.step) { setPlaying(false); return step(Number(t.dataset.step)); }
    if (t.hasAttribute('data-gear')) {
      const pop = root.querySelector('.ds-pop'); pop.hidden = !pop.hidden; t.setAttribute('aria-expanded', String(!pop.hidden)); return;
    }
    if (t.hasAttribute('data-guide-close')) { store.set('dunesight-guide-seen', '1'); root.dataset.guide = 'false'; return; }
    if (t.dataset.action) call(`on${t.dataset.action[0].toUpperCase()}${t.dataset.action.slice(1)}`);
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.layer) { state.layers[state.mode][t.dataset.layer] = t.checked; return call('onLayerToggle', t.dataset.layer, t.checked, state.mode); }
    if (t.dataset.setting) {
      state.settings[t.dataset.setting] = t.type === 'checkbox' ? t.checked : t.value;
      renderTime(); return call('onSettingChange', t.dataset.setting, state.settings[t.dataset.setting]);
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
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); step(-1); }
    else if (e.key === 'Escape') { const pop = root.querySelector('.ds-pop'); if (pop && !pop.hidden) pop.hidden = true; }
  };
  document.addEventListener('keydown', onKey);

  render();

  // ---------- public API ----------
  return {
    setData(data) { state.data = data; state.year = Math.min(state.year, data.timeline.end); render(); },
    setMode: (m) => setMode(m, false),
    setYear: (y) => setYear(y, false),
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    showGuide: () => { root.dataset.guide = 'true'; },
    getState: () => ({ mode: state.mode, year: state.year, layers: structuredClone(state.layers[state.mode]), settings: { ...state.settings }, siteId: state.siteId }),
    destroy() { setPlaying(false); document.removeEventListener('keydown', onKey); root.remove(); },
  };
}
