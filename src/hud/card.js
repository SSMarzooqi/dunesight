// Info cards for a picked dune, target or motion arrow: every number with units and its range where the data gives one, plus the data source.
import { esc, num, speed, range, metres, km2, heading, int, date, isNum, statusWords, typeWords, rows } from '../format.js';
import { classStyle, statusStyle } from '../layers/util.js';
import { MAP_STYLE } from '../ui/ui.js';

const chip = (color, text) => `<span class="ds-chip"><i style="background:${color}"></i>${esc(text)}</span>`;

function reachYears(min, max, maxUncapped, med) {
  if (!isNum(min)) return null;
  let maxText;
  if (isNum(max)) maxText = String(max);
  else if (isNum(maxUncapped)) maxText = `after 2100 (slow case ${maxUncapped})`;
  else maxText = 'after 2100';
  return `<b>${min} – ${maxText}</b>${isNum(med) ? ` (median ${med})` : ''}`;
}

export function duneCard(d, b) {
  const p = d.props;
  const below = p.below_detection_limit === true;
  const lim = isNum(p.detection_limit_myr) ? p.detection_limit_myr : b.summary?.detection_limit_myr;
  const speedText = below
    ? `<b>&lt; ${num(lim, 2)} m/yr</b> (below detection limit)`
    : isNum(p.speed_med_myr)
      ? `<b>${num(p.speed_med_myr, 2)}</b> (${range(p.speed_lo_myr, p.speed_hi_myr)}) m/yr`
      : null;
  const headingText = below || !isNum(p.heading_deg) ? 'not measurable (no detected motion)' : heading(p.heading_deg);
  const agreement = below || !isNum(p.wind_agreement_deg) ? 'not measurable' : `${num(p.wind_agreement_deg, 0)}° between heading and the MERRA-2 resultant drift direction`;
  let reach = reachYears(p.reach_year_min, p.reach_year_max, null, null);
  if (!reach) reach = 'not reached by 2100';
  else reach += ' <span class="ds-dim">(fast case – slow case)</span>';
  const confidence = p.confidence ? `${esc(p.confidence)}${isNum(p.n_windows) ? ` (${int(p.n_windows)} windows of 480 m)` : ''}` : null;
  const source = p.speed_source === 'height_model' ? 'height model (speed = k / height), not tracked' : p.speed_source === 'tracked' ? 'tracked (Landsat 8/9 pan)' : esc(p.speed_source);

  return {
    title: `Dune ${esc(p.id)}`,
    tag: chip(classStyle(p.class)[0], p.class || 'unclassified'),
    html: `<dl class="ds-dl ds-card-rows">${rows([
      ['Speed', speedText],
      ['Heading', headingText],
      ['Uncertainty', isNum(p.uncertainty_myr) ? `± ${num(p.uncertainty_myr, 2)} m/yr (1σ per component)` : null],
      ['Confidence', confidence],
      ['Speed from', source],
      ['Height', isNum(p.height_m) ? `${num(p.height_m, 1)} m <span class="ds-dim">(NASADEM, Feb 2000)</span>` : null],
      ['Area', km2(p.area_km2) ? `${km2(p.area_km2)} <span class="ds-dim">(outlined part)</span>` : null],
      ['Wind agreement', agreement],
      ['Nearest target', p.nearest_target ? `${esc(p.nearest_target)}${isNum(p.distance_to_target_m) ? `, ${metres(p.distance_to_target_m, 0)}` : ''}` : null],
      ['Reach years', reach],
      ['Threat', p.threat === true ? '<b>yes</b>: fast case reaches a target by 2050' : 'no: fast case reaches no target by 2050'],
      ['Position', p.position_date ? `outline shifted to ${esc(date(p.position_date))} by its measured motion` : null],
    ])}</dl>
    ${p.threat_basis ? `<p class="ds-caption ds-fine">Reach basis: ${esc(p.threat_basis)}.</p>` : ''}
    ${p.motion_scale_note ? `<p class="ds-caption ds-fine">${esc(p.motion_scale_note.replace(/^./, (c) => c.toUpperCase()))}.</p>` : ''}
    ${p.outline_source || p.height_source ? `<p class="ds-caption ds-fine">Outline: ${esc(p.outline_source || '')}${p.height_source ? `; height: ${esc(p.height_source)}` : ''}.</p>` : ''}`,
    source: 'NASADEM (outline, height) · Landsat 8/9 OLI pan 15 m (motion) · dunes.geojson',
  };
}

export function targetCard(t, b, { state: displayState, year, rule }) {
  const p = t.props;
  const a = p.approach && typeof p.approach === 'object' ? p.approach : null;
  let reach = reachYears(p.hit_year_min, p.hit_year_max, p.hit_year_max_uncapped, p.hit_year_med);
  let reachNote = '';
  if (reach) reachNote = 'Fast case (speed + 1σ, shortest plausible gap) – slow case (speed − 1σ, longest gap).';
  else if (p.threat_status === 'possible_within_direction_uncertainty') reach = 'no reach year: reached only if the heading is off by its uncertainty';
  else reach = 'not reached by 2100 along the measured heading';

  const stateWords = {
    hit: `reached by ${year} (${rule === 'med' ? 'median' : 'fast-case'} reach year)`,
    pending: `not yet reached in ${year}`,
    possible: 'no reach year',
    none: 'not reached by 2100',
  }[displayState];

  const src = p.source || 'OpenStreetMap';
  const osm = b.targets?.osm;
  const srcExtra = /openstreetmap/i.test(src) && osm?.timestamp_osm_base ? ` (© OpenStreetMap contributors, data of ${esc(date(osm.timestamp_osm_base))})` : /HLS/.test(src) ? ' (vegetated outline from NASA HLS NDVI)' : '';

  return {
    title: esc(p.name || p.id),
    tag: chip(statusStyle(p.threat_status)[0], statusWords(p.threat_status) || 'status unknown'),
    html: `<dl class="ds-dl ds-card-rows">${rows([
      ['Type', `${esc(typeWords(p.type))}${p.class ? ` <span class="ds-dim">(${esc(p.class)})</span>` : ''}`],
      ['Status', `${esc(statusWords(p.threat_status))}${stateWords ? ` <span class="ds-dim">· on the map: ${stateWords}</span>` : ''}`],
      ['Reach years', reach],
      ['Gap', isNum(p.gap_m) ? `${metres(p.gap_m)} <span class="ds-dim">(sand edge to target footprint)</span>` : null],
      ['Moving sand', a && isNum(a.speed_myr) ? `${speed(a.speed_myr)} (fast ${num(a.fast_myr, 2) ?? '—'}, slow ${num(a.slow_myr, 2) ?? '—'}) toward ${heading(a.heading_deg)}` : null],
      [
        'Free sand',
        p.borders_free_sand === true
          ? 'borders free sand: exposed to blowing sand today <span class="ds-dim">(not forecast by this tool)</span>'
          : p.borders_free_sand === false
            ? 'does not border free sand'
            : null,
      ],
      ['Length', p.type === 'road' && isNum(p.length_m) ? metres(p.length_m, 0) : null],
      ['ID', esc(p.id)],
    ])}</dl>
    ${reachNote ? `<p class="ds-caption ds-fine">${reachNote}</p>` : ''}
    ${p.threat_status === 'sand_at_edge_now' ? '<p class="ds-caption ds-fine">“Sand at edge now”: migrating sand is already within the edge uncertainty (± 7.5 m pixel half-width plus the outline uncertainty) of this target.</p>' : ''}`,
    source: `${esc(src)}${srcExtra} · reach years: Landsat 8/9 motion 2013–2025 · targets.geojson`,
  };
}

export function arrowCard(v, b) {
  const p = v.props;
  const base = b.summary?.baseline;
  const latestYear = b.derived.latestObserved?.year;
  const by2050 = isNum(latestYear) && isNum(p.speed_myr) ? p.speed_myr * (2050 - latestYear) : null;
  return {
    title: 'Motion window',
    tag: chip(MAP_STYLE.measured, 'measured'),
    html: `<dl class="ds-dl ds-card-rows">${rows([
      ['Speed', isNum(p.speed_myr) ? `<b>${num(p.speed_myr, 2)} ± ${num(p.uncertainty_myr, 2) ?? '—'} m/yr</b> <span class="ds-dim">(± 1σ per component)</span>` : null],
      ['Heading', heading(p.heading_deg)],
      ['East / North', isNum(p.east_myr) && isNum(p.north_myr) ? `${num(p.east_myr, 2)} / ${num(p.north_myr, 2)} m/yr` : null],
      ['Detection limit', isNum(p.detection_limit_myr) ? `${num(p.detection_limit_myr, 2)} m/yr at this window${isNum(p.speed_myr) ? ` (speed is ${num(p.speed_myr / p.detection_limit_myr, 1)}× the limit)` : ''}` : null],
      ['Quality', isNum(p.quality) ? `${num(p.quality, 2)} <span class="ds-dim">(0–1: correlation peak × share of pairs used)</span>` : null],
      ['By 2050', isNum(by2050) ? `<span class="ds-tag-projected">PROJECTED</span> ${metres(by2050)} from its ${latestYear} position if the rate continues` : null],
      ['Window', `480 m, centre ${num(v.lonlat[1], 4)}° N, ${num(v.lonlat[0], 4)}° E`],
    ])}</dl>`,
    source: `Landsat 8/9 OLI pan 15 m${base ? `, ${esc(date(base.start_date))} – ${esc(date(base.end_date))}` : ''} · vectors.geojson`,
  };
}
