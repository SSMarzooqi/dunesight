// Timeline model and control: weather-radar style bar from the first observed scene to 2050 with real gaps, observed/projected division, play/step/scrub and the label of the frame on screen.
import { state, set, on } from './state.js';
import { date, esc, metres, num, pct } from './format.js';

export const END_YEAR = 2050;
const STEP_MS = 600;

/** Timeline stops for a site: every observed frame, then every projected year to 2050. */
export function buildStops(manifest) {
  const obs = (manifest?.observed || []).filter((o) => Number.isFinite(o.year)).sort((a, b) => a.year - b.year);
  const med = (manifest?.projected_median || []).filter((p) => Number.isFinite(p.year)).sort((a, b) => a.year - b.year);
  const fast = (manifest?.projected_fast || []).filter((p) => Number.isFinite(p.year)).sort((a, b) => a.year - b.year);
  const latest = obs[obs.length - 1] || null;
  const stops = obs.map((o) => ({ year: o.year, kind: 'observed', frame: o }));
  if (latest) {
    const firstP = med[0]?.year ?? latest.year + 5;
    const lastP = med[med.length - 1]?.year ?? END_YEAR;
    for (let y = latest.year + 1; y <= END_YEAR; y++) {
      const m = [...med].reverse().find((p) => p.year <= y) || null;
      const f = [...fast].reverse().find((p) => p.year <= y) || null;
      // Median-case tint opacity falls linearly from 55 % at the first projected frame to 30 % at the last.
      const span = Math.max(1, lastP - firstP);
      const medAlpha = m ? 0.55 - (0.25 * (m.year - firstP)) / span : 0;
      stops.push({ year: y, kind: 'projected', base: latest, med: m, fast: f, medAlpha, yearsSince: y - latest.year, isFrameYear: !!med.find((p) => p.year === y) });
    }
  }
  const gaps = [];
  for (let i = 1; i < obs.length; i++) {
    if (obs[i].year - obs[i - 1].year > 1) gaps.push([obs[i - 1].year + 1, obs[i].year - 1]);
  }
  return { stops, gaps, first: obs[0]?.year ?? 2000, latest, med, fast };
}

/** Human description of what is on screen for a stop (used by the timeline label and the source line). */
export function describeStop(stop, manifest) {
  if (!stop) return { badge: '', html: '' };
  if (stop.kind === 'observed') {
    const o = stop.frame;
    const parts = [
      `<b>${esc(date(o.date) || String(o.year))}</b>`,
      esc(o.sensor),
      Number.isFinite(o.pixel_m) ? `${o.pixel_m} m pixel` : null,
      o.scene_id ? `scene <span class="mono-s">${esc(o.scene_id)}</span>` : null,
      Number.isFinite(o.sun_elevation_deg) ? `sun elevation ${num(o.sun_elevation_deg, 1)}°` : null,
    ].filter(Boolean);
    return { badge: 'OBSERVED', html: parts.join(' · ') };
  }
  const base = stop.base;
  if (!stop.med) {
    return {
      badge: 'PROJECTED',
      html: `<b>${stop.year}</b> · no projected frame before ${esc(manifest?.projected_median?.[0]?.year ?? '')}: image is the latest observed scene (${esc(date(base?.date))}); yellow tracks on the arrows show true displacement since then (${stop.yearsSince} yr at the measured speed)`,
    };
  }
  const d = stop.med.displacement || {};
  const stat = [
    Number.isFinite(d.median_m) ? `moving sand shifts a median <b>${metres(d.median_m)}</b>` : null,
    Number.isFinite(d.p90_m) ? `p90 ${metres(d.p90_m)}` : null,
    Number.isFinite(d.max_m) ? `max ${metres(d.max_m)}` : null,
    Number.isFinite(d.share_of_box_moving_pct) ? `${pct(d.share_of_box_moving_pct)} of the box moving` : null,
  ].filter(Boolean);
  const frameNote = stop.med.year === stop.year ? '' : ` (frame for ${stop.med.year}; next frame ${stop.med.year + 5 <= END_YEAR ? stop.med.year + 5 : '—'})`;
  const adv = Number.isFinite(stop.med.years_advected) ? `, advected ${num(stop.med.years_advected, 1)} yr from ${esc(date(stop.med.from_date || base?.date))}` : '';
  return {
    badge: 'PROJECTED',
    html: `<b>${stop.year}</b> · median-case projection${frameNote}${adv} · by ${stop.med.year}: ${stat.join(', ')}`,
  };
}

export function createTimeline(root, { onStop }) {
  root.innerHTML = `
    <div class="tl-controls">
      <button class="tl-btn" data-act="back" title="Step back (←)" aria-label="Step back">&#9664;&#9664;</button>
      <button class="tl-btn tl-play" data-act="play" title="Play / pause (space)" aria-label="Play">&#9654;</button>
      <button class="tl-btn" data-act="fwd" title="Step forward (→)" aria-label="Step forward">&#9654;&#9654;</button>
    </div>
    <div class="tl-main">
      <div class="tl-bar" role="slider" tabindex="0" aria-label="Timeline year"></div>
      <div class="tl-label"><span class="tl-badge"></span><span class="tl-text"></span>
        <span class="tl-note" tabindex="0" hidden>reading note<span class="tl-note-pop"></span></span></div>
    </div>
    <div class="tl-options">
      <label title="Which reach year turns a target to its hit colour"><span>Hit year</span>
        <select data-opt="hitRule"><option value="min">fast case (min)</option><option value="med">median</option></select></label>
      <label><input type="checkbox" data-opt="showFast"> fast-case frame</label>
      <label title="Pixels that differ by more than 10 grey levels from the latest observed frame"><input type="checkbox" data-opt="showChange"> changed pixels</label>
    </div>`;
  const bar = root.querySelector('.tl-bar');
  const badge = root.querySelector('.tl-badge');
  const text = root.querySelector('.tl-text');
  const note = root.querySelector('.tl-note');
  const notePop = root.querySelector('.tl-note-pop');
  const playBtn = root.querySelector('.tl-play');

  let model = null;
  let manifest = null;
  let idx = 0;
  let timer = null;

  const x = (year) => ((year - model.first + 0.5) / (END_YEAR - model.first + 1)) * 100;

  function render() {
    const { stops, gaps, latest, first } = model;
    const parts = [];
    const latestYear = latest?.year ?? first;
    parts.push(`<div class="tl-seg tl-seg-obs" style="left:${x(first - 0.5)}%;width:${x(latestYear + 0.5) - x(first - 0.5)}%"></div>`);
    parts.push(`<div class="tl-seg tl-seg-prj" style="left:${x(latestYear + 0.5)}%;width:${x(END_YEAR + 0.5) - x(latestYear + 0.5)}%"></div>`);
    for (const [a, b] of gaps) {
      const w = x(b + 0.5) - x(a - 0.5);
      const label = b - a >= 3 ? `no scenes ${a}–${b}` : '';
      parts.push(`<div class="tl-gap" style="left:${x(a - 0.5)}%;width:${w}%" title="No usable November Landsat scene ${a === b ? a : `${a}–${b}`}: shown as a gap, not interpolated">${label}</div>`);
    }
    parts.push(`<div class="tl-divider" style="left:${x(latestYear + 0.5)}%"><span>OBSERVED ◂ ▸ PROJECTED</span></div>`);
    stops.forEach((s, i) => {
      const isFrame = s.kind === 'observed' || s.isFrameYear;
      if (!isFrame) return;
      const showYear = s.kind === 'observed' ? i === 0 || s.year === latestYear || (stops[i - 1] && s.year - stops[i - 1].year > 1) : s.year % 10 === 0;
      parts.push(`<div class="tl-tick ${s.kind}" style="left:${x(s.year)}%" data-i="${i}">${showYear ? `<span>${s.year}</span>` : ''}</div>`);
    });
    parts.push('<div class="tl-cursor"><span></span></div>');
    bar.innerHTML = parts.join('');
    manifest?.projection_reading_note ? (notePop.textContent = manifest.projection_reading_note) : (notePop.textContent = '');
  }

  function update() {
    const s = model.stops[idx];
    const cur = bar.querySelector('.tl-cursor');
    cur.style.left = `${x(s.year)}%`;
    cur.className = `tl-cursor ${s.kind}`;
    cur.querySelector('span').textContent = s.year;
    bar.setAttribute('aria-valuenow', s.year);
    bar.setAttribute('aria-valuetext', `${s.year} ${s.kind}`);
    const d = describeStop(s, manifest);
    badge.textContent = d.badge;
    badge.className = `tl-badge ${s.kind}`;
    text.innerHTML = d.html;
    note.hidden = !(s.kind === 'projected' && manifest?.projection_reading_note);
    onStop?.(s);
  }

  function go(i) {
    if (!model) return;
    idx = Math.max(0, Math.min(model.stops.length - 1, i));
    update();
  }

  function play() {
    if (timer) return;
    if (idx >= model.stops.length - 1) go(0);
    playBtn.innerHTML = '&#10074;&#10074;';
    playBtn.setAttribute('aria-label', 'Pause');
    root.classList.add('playing');
    timer = setInterval(() => {
      if (idx >= model.stops.length - 1) {
        pause();
        return;
      }
      go(idx + 1);
    }, STEP_MS);
  }
  function pause() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.innerHTML = '&#9654;';
    playBtn.setAttribute('aria-label', 'Play');
    root.classList.remove('playing');
  }

  root.querySelector('[data-act="play"]').addEventListener('click', () => (timer ? pause() : play()));
  root.querySelector('[data-act="back"]').addEventListener('click', () => {
    pause();
    go(idx - 1);
  });
  root.querySelector('[data-act="fwd"]').addEventListener('click', () => {
    pause();
    go(idx + 1);
  });

  function yearAt(clientX) {
    const r = bar.getBoundingClientRect();
    const t = (clientX - r.left) / r.width;
    return model.first - 0.5 + t * (END_YEAR - model.first + 1);
  }
  function nearestStop(year) {
    let best = 0;
    let bd = Infinity;
    model.stops.forEach((s, i) => {
      const d = Math.abs(s.year - year);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  let dragging = false;
  bar.addEventListener('pointerdown', (e) => {
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    pause();
    go(nearestStop(yearAt(e.clientX)));
  });
  bar.addEventListener('pointermove', (e) => {
    if (dragging) {
      const i = nearestStop(yearAt(e.clientX));
      if (i !== idx) go(i);
    }
  });
  bar.addEventListener('pointerup', () => (dragging = false));
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'ArrowRight') go(idx + 1);
    else return;
    e.preventDefault();
  });

  for (const el of root.querySelectorAll('[data-opt]')) {
    const key = el.dataset.opt;
    const sync = () => {
      if (el.type === 'checkbox') el.checked = !!state[key];
      else el.value = state[key];
    };
    sync();
    on(key, sync);
    el.addEventListener('change', () => set(key, el.type === 'checkbox' ? el.checked : el.value));
  }

  return {
    setSite(bundle, { year } = {}) {
      pause();
      manifest = bundle.manifest;
      model = buildStops(manifest);
      render();
      const want = year ?? model.latest?.year;
      go(Math.max(0, model.stops.findIndex((s) => s.year === want)));
    },
    goYear(year) {
      if (!model) return false;
      const i = model.stops.findIndex((s) => s.year === year);
      if (i < 0) return false;
      pause();
      go(i);
      return true;
    },
    step: (d) => {
      pause();
      go(idx + d);
    },
    toggle: () => (timer ? pause() : play()),
    play,
    pause,
    get playing() {
      return !!timer;
    },
    get model() {
      return model;
    },
    get stop() {
      return model?.stops[idx] || null;
    },
  };
}
