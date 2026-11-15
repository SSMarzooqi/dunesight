// HUD panels: collapsible panel frame (state kept per session), the headline numbers from summary.json, and the ranked list of reached targets in Threat mode.
import { esc, num, range, pct, int, heading, date, metres, statusWords, typeWords, isNum } from '../format.js';
import { STATUS_COLORS } from '../layers/util.js';

const KEY = 'dunesight.collapsed.';

function getCollapsed(id) {
  try {
    return sessionStorage.getItem(KEY + id) === '1';
  } catch {
    return false;
  }
}
function setCollapsed(id, v) {
  try {
    sessionStorage.setItem(KEY + id, v ? '1' : '0');
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

/** Turn a <section> into a titled, collapsible HUD panel. Returns the body element. */
export function panelFrame(section, id, title, { source } = {}) {
  section.classList.add('hud', 'panel');
  section.dataset.panel = id;
  section.innerHTML = `
    <header class="panel-head"><h2>${title}</h2>
      <button class="collapse" aria-label="Collapse ${title}" aria-expanded="true">–</button></header>
    <div class="panel-body"></div>
    ${source ? `<footer class="panel-src"></footer>` : ''}`;
  const btn = section.querySelector('.collapse');
  const apply = (c) => {
    section.classList.toggle('collapsed', c);
    btn.textContent = c ? '+' : '–';
    btn.setAttribute('aria-expanded', String(!c));
  };
  apply(getCollapsed(id));
  btn.addEventListener('click', () => {
    const c = !section.classList.contains('collapsed');
    setCollapsed(id, c);
    apply(c);
  });
  return section.querySelector('.panel-body');
}

const srcLink = (label, anchor) => `<a href="#" class="src" data-dossier="${anchor}">${label}</a>`;

const CONFIRM_WORDS = { confirmed: 'confirmed', partly_confirmed: 'partly confirmed', not_confirmed: 'not confirmed' };

/** How well the headline speed and heading are confirmed by independent checks (summary.confirmation, from notebook 03). */
export function confirmLine(c) {
  if (!c || !c.speed || !c.heading) return '';
  const row = (label, q) =>
    CONFIRM_WORDS[q.status]
      ? `<div class="cf-row" data-confirm="${esc(label.toLowerCase())}" data-status="${esc(q.status)}"><span class="cf cf-${esc(q.status)}">${esc(label)} ${esc(CONFIRM_WORDS[q.status])}</span>${q.short ? ` <span class="cf-why">${esc(q.short)}</span>` : ''}</div>`
      : '';
  return `<div class="confirm" title="Independent cross-checks of the headline speed and heading">${row('Speed', c.speed)}${row('Heading', c.heading)}<div class="cf-more"><a href="#" class="src" data-dossier="crosschecks">cross-checks</a></div></div>`;
}

/** Headline numbers. */
export function renderHeadline(body, b) {
  const s = b.summary || {};
  const d = b.derived;
  const t = s.threat || {};
  const by = t.targets_by_type || {};
  const disp = s.frames?.median_case_2050_displacement || {};
  const cls = s.counts_by_class || {};
  const projYear = (s.frames?.projected_years || []).slice(-1)[0] ?? 2050;

  const typeCells = (key) => ['road', 'farm', 'building'].map((k) => `<td>${isNum(by[k]?.[key]) ? int(by[k][key]) : '—'}</td>`).join('');

  const share = isNum(d.detectedPct) ? `${num(d.detectedPct, 0)} %` : null;
  const lim = isNum(s.detection_limit_myr) ? s.detection_limit_myr : null;

  body.innerHTML = `
    <div class="kpi">
      <div class="kpi-num">${num(s.speed_median_myr, 2) ?? '—'}<span class="unit">m/yr</span>${isNum(d.fieldHeading) ? `<span class="kpi-dir">toward ${heading(d.fieldHeading)}</span>` : ''}</div>
      <div class="kpi-label">median speed where motion is detected · 10–90 %: ${range(s.speed_p10_myr, s.speed_p90_myr, 'm/yr') ?? 'not given'}</div>
    </div>
    ${confirmLine(s.confirmation)}
    <dl class="facts">
      ${share ? `<dt>Detected</dt><dd><b>${share}</b> of ${isNum(d.validN) ? int(d.validN) : ''} dune windows (480 m)${lim !== null ? `; the rest move &lt; ${num(lim, 2)} m/yr (detection limit)` : ''}</dd>` : ''}
      ${s.baseline ? `<dt>Baseline</dt><dd>${esc(date(s.baseline.start_date))} → ${esc(date(s.baseline.end_date))}${isNum(s.baseline.years) ? ` (${num(s.baseline.years, 1)} yr)` : ''}${isNum(s.uncertainty_myr) ? ` · ± ${num(s.uncertainty_myr, 2)} m/yr (1σ)` : ''}</dd>` : ''}
      <dt>Large dunes</dt><dd><b>${int(s.n_dunes) ?? '—'}</b> outlined <span class="dim">(NASADEM, Feb 2000)</span>
        <div class="classbar">${['stable', 'slow', 'active', 'fast'].map((c) => `<span class="cls cls-${c}" title="${c}">${c} <b>${int(cls[c]) ?? 0}</b></span>`).join('')}</div>
        ${d.classRule ? `<div class="fine">${esc(d.classRule)}</div>` : ''}</dd>
    </dl>
    <table class="tgt-table">
      <thead><tr><th>Targets${isNum(t.n_targets) ? ` <span class="dim">of ${int(t.n_targets)}</span>` : ''}</th><th>all</th><th>roads</th><th>farms</th><th>built-up</th></tr></thead>
      <tbody>
        <tr><td><i class="sw" style="background:${STATUS_COLORS.sand_at_edge_now}"></i>Sand at edge now</td><td><b>${int(t.n_sand_at_edge_now) ?? '—'}</b></td>${typeCells('sand_at_edge_now')}</tr>
        <tr><td><i class="sw" style="background:${STATUS_COLORS.reached_by_2050}"></i>Reached by 2050<span class="dim">*</span></td><td><b>${int(t.n_reached_by_2050) ?? '—'}</b></td>${typeCells('reached_by_2050')}</tr>
      </tbody>
    </table>
    <div class="fine">* includes sand at edge now; fast-case reach year (speed + 1σ).</div>
    ${isNum(disp.median_m) ? `<div class="proj-line"><span class="tag-prj">PROJECTED</span> by ${projYear}: moving sand shifts a median <b>${metres(disp.median_m)}</b> (p90 ${metres(disp.p90_m) ?? '—'}); ${pct(disp.share_of_box_moving_pct) ?? '—'} of the box moves</div>` : ''}
  `;
  return `Landsat 7 / 8-9 pan 15 m, NASADEM, OSM, HLS · ${srcLink('summary.json → How we know', 'uncertainty')}`;
}

/** Ranked list of targets reached (earliest hit_year_min, then smallest gap). */
export function renderThreatList(body, b, { onPick, filter = 'all' }) {
  const t = b.targets?.features || [];
  const byId = new Map(t.map((f) => [f.properties.id, f.properties]));
  const ids = b.derived.ranked.filter((id) => filter === 'all' || byId.get(id)?.type === filter);
  const possible = b.derived.statusCounts.possible_within_direction_uncertainty || 0;
  const chips = ['all', 'road', 'farm', 'building']
    .map((k) => `<button class="chip${k === filter ? ' on' : ''}" data-filter="${k}">${k === 'all' ? 'all' : k === 'building' ? 'built-up' : `${k}s`}</button>`)
    .join('');
  body.innerHTML = `
    <div class="tl-hint">Earliest reach year (fast case) first, then smallest gap. Click to fly there.</div>
    <div class="chips">${chips}</div>
    <ol class="threat-list">${ids
      .map((id) => {
        const p = byId.get(id);
        const max = isNum(p.hit_year_max) ? p.hit_year_max : 'after 2100';
        return `<li><button data-target="${esc(id)}" title="${esc(p.name)}">
          <i class="sw" style="background:${STATUS_COLORS[p.threat_status] || '#888'}"></i>
          <span class="yr">${p.hit_year_min}</span>
          <span class="nm">${esc(p.name)}</span>
          <span class="meta">${esc(typeWords(p.type))} · ${p.hit_year_min}–${max}${isNum(p.hit_year_med) ? ` (med ${p.hit_year_med})` : ''}${isNum(p.gap_m) ? ` · gap ${metres(p.gap_m)}` : ''}</span>
        </button></li>`;
      })
      .join('')}</ol>
    <div class="fine">${ids.length} target${ids.length === 1 ? '' : 's'} with a reach year by 2100${possible ? `; ${possible} more are ${statusWords('possible_within_direction_uncertainty').toLowerCase()} (no year, purple on the map)` : ''}.</div>`;
  body.querySelectorAll('[data-target]').forEach((el) => el.addEventListener('click', () => onPick(el.dataset.target)));
  body.querySelectorAll('[data-filter]').forEach((el) =>
    el.addEventListener('click', () => renderThreatList(body, b, { onPick, filter: el.dataset.filter })),
  );
}
