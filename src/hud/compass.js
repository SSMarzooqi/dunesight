// Wind compass: 16-sector MERRA-2 sand rose (wind FROM), the resultant drift direction (sand moves TOWARD), the measured dune heading, and the optional station result.
import { esc, num, heading, isNum, int, compassPoint } from '../format.js';

const SIZE = 220;
const CX = SIZE / 2;
const R = 82;

function polar(deg, r) {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CX - r * Math.cos(a)];
}

function arrow(deg, len, cls, label) {
  const [x2, y2] = polar(deg, len);
  const [hx1, hy1] = polar(deg - 7, len - 13);
  const [hx2, hy2] = polar(deg + 7, len - 13);
  return `<g class="${cls}"><line x1="${CX}" y1="${CX}" x2="${x2}" y2="${y2}"/><polygon points="${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}"/><title>${esc(label)}</title></g>`;
}

/** Reads the station result from station_wind.json (written by notebook 01b); null if absent, unusable or flagged not representative. */
function stationRdd(st) {
  if (!st || st.has_usable_station === false || st.representative === false) return null;
  const cand = [st.station?.RDD_deg, st.station_result?.RDD_deg, st.RDD_deg];
  const v = cand.find(isNum);
  if (!isNum(v)) return null;
  const s = st.station || {};
  return {
    rdd: v,
    name: s.name || st.station_name || null,
    dist: s.distance_km ?? st.distance_km ?? null,
    bearing: isNum(s.bearing_from_site_deg) ? s.bearing_from_site_deg : null,
    dp: isNum(s.DP) ? s.DP : null,
    dpClass: s.dp_class || null,
    rdpdp: s.RDP_DP ?? null,
    period: st.period || null,
    years: isNum(s.years) ? s.years : null,
    pctMin: isNum(s.hours_reported_pct_min) ? s.hours_reported_pct_min : null,
    pctMax: isNum(s.hours_reported_pct_max) ? s.hours_reported_pct_max : null,
    note: st.note || null,
    limits: Array.isArray(st.limits) ? st.limits : [],
    source: st.source || null,
  };
}

/** One-line station facts with its own limits (distance, record, its own DP class). */
function stationFacts(st) {
  const where = [isNum(st.dist) ? `${num(st.dist, 0)} km` : null, isNum(st.bearing) ? compassPoint(st.bearing) : null].filter(Boolean).join(' ');
  const rec = st.period ? `${esc(st.period)}${isNum(st.pctMin) && isNum(st.pctMax) ? `, ${num(st.pctMin, 0)}–${num(st.pctMax, 0)} % of hours reported` : ''}` : '';
  return `<dt>Station</dt><dd class="station-facts">${esc(st.name || 'ground station')}${where ? ` · ${esc(where)} of the box` : ''}${rec ? ` · ${rec}` : ''}${isNum(st.dp) ? ` · its DP ${num(st.dp, 0)} VU/yr${st.dpClass ? ` (${esc(st.dpClass)})` : ''}` : ''}<div class="fine">Explains the heading difference; MERRA-2 stays the main wind figure. <a href="#" class="src" data-dossier="station">limits</a></div></dd>`;
}

export function renderCompass(body, b) {
  const w = b.wind || {};
  const rose = Array.isArray(w.sand_rose) ? w.sand_rose.filter((s) => isNum(s.sector_deg) && isNum(s.dp)) : [];
  const max = Math.max(...rose.map((s) => s.dp), 1e-9);
  const field = b.derived.fieldHeading;
  const st = stationRdd(b.station);

  const petals = rose
    .map((s) => {
      const r = 12 + (R - 12) * Math.sqrt(s.dp / max); // area-true: petal area ∝ DP
      const [x1, y1] = polar(s.sector_deg - 10, r);
      const [x2, y2] = polar(s.sector_deg + 10, r);
      const [x0, y0] = polar(s.sector_deg - 10, 12);
      const [x3, y3] = polar(s.sector_deg + 10, 12);
      return `<path class="petal" d="M${x0},${y0} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} L${x3},${y3} A12,12 0 0 0 ${x0},${y0} Z"><title>wind FROM ${num(s.sector_deg, 1)}°: DP ${num(s.dp, 2)} VU/yr</title></path>`;
    })
    .join('');
  const ticks = ['N', 'E', 'S', 'W']
    .map((t, i) => {
      const [x, y] = polar(i * 90, R + 13);
      return `<text x="${x}" y="${y}" class="cardinal">${t}</text>`;
    })
    .join('');
  const rings = [0.5, 1].map((f) => `<circle cx="${CX}" cy="${CX}" r="${12 + (R - 12) * f}" class="ring"/>`).join('');

  const diff = isNum(field) && isNum(w.RDD_deg) ? Math.abs(((field - w.RDD_deg + 540) % 360) - 180) : null;

  body.innerHTML = `
    <div class="compass-wrap">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" class="compass" role="img" aria-label="Sand rose and drift directions">
        ${rings}${petals}${ticks}
        ${isNum(w.RDD_deg) ? arrow(w.RDD_deg, R + 2, 'arr-rdd', `RDD ${num(w.RDD_deg, 1)}°: resultant drift direction (sand moves toward)`) : ''}
        ${isNum(field) ? arrow(field, R - 8, 'arr-field', `measured dune heading ${num(field, 1)}°`) : ''}
        ${st ? arrow(st.rdd, R - 20, 'arr-station', `station RDD ${num(st.rdd, 1)}°`) : ''}
        <circle cx="${CX}" cy="${CX}" r="3" class="hub"/>
      </svg>
      <ul class="compass-key">
        <li><i class="k-petal"></i>Wind blowing <b>from</b> each sector (area ∝ drift potential)</li>
        ${isNum(w.RDD_deg) ? `<li><i class="k-rdd"></i>Sand driven <b>toward</b> ${heading(w.RDD_deg)} <span class="dim">(RDD)</span></li>` : ''}
        ${isNum(field) ? `<li><i class="k-field"></i>Dunes measured moving <b>${heading(field)}</b> <span class="dim">(mean of ${int(b.derived.nVectors)} arrows)</span></li>` : ''}
        ${st ? `<li class="station-line"><i class="k-station"></i>Ground station: sand driven <b>toward ${heading(st.rdd)}</b></li>` : ''}
      </ul>
    </div>
    <dl class="facts">
      ${isNum(w.DP) ? `<dt>DP</dt><dd><b>${num(w.DP, 1)}</b> VU/yr${w.dp_class ? ` (${esc(w.dp_class)} energy)` : ''}</dd>` : ''}
      ${isNum(w.RDP) ? `<dt>RDP</dt><dd>${num(w.RDP, 1)} VU/yr · RDP/DP ${num(w.RDP_DP, 2) ?? '—'}</dd>` : ''}
      ${isNum(diff) ? `<dt>Agreement</dt><dd>dunes move <b>${num(diff, 0)}°</b> from RDD</dd>` : ''}
      ${st ? stationFacts(st) : ''}
      <dt>Wind data</dt><dd>${esc(w.source || 'NASA MERRA-2')}${w.period ? `, ${esc(w.period)}` : ''}${isNum(w.threshold_kt) ? `; threshold ${w.threshold_kt} kt` : ''}</dd>
    </dl>
    ${b.summary?.wind_agreement_note ? `<details class="why"><summary>Why the dunes and the wind ${isNum(diff) && diff > 30 ? 'disagree' : 'agree'}</summary><p>${esc(b.summary.wind_agreement_note)}</p>${st?.note ? `<p><b>Ground station check:</b> ${esc(st.note)}</p>${st.limits.length ? `<ul class="station-limits">${st.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}` : ''}<p class="dim">MERRA-2 is a ~0.5° × 0.625° NASA reanalysis of hourly means; absolute DP is approximate, RDD is the more robust comparison.</p></details>` : ''}
    ${st && !b.summary?.wind_agreement_note && st.note ? `<p class="fine">${esc(st.note)}</p>` : ''}`;
  return `NASA MERRA-2 (wind) · Landsat 8/9 (dune heading)${st ? ' · NOAA ISD (station)' : ''} · <a href="#" class="src" data-dossier="${st ? 'station' : 'method'}">method</a>`;
}
