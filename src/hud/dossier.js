// "How we know" dossier for the current site, composed from the data files: method, datasets with links/DOIs, data handling, uncertainty, validation, threat definition, limits and repo links.
import { esc, num, date, isNum, int, pct } from '../format.js';
import { CREDIT_LINE } from './credits.js';

const REPO = 'https://github.com/SSMarzooqi/dunesight';

const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : null);
const link = (u, text) => (safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(text || u)}</a>` : '');
const para = (label, text) => (text ? `<p>${label ? `<b>${esc(label)}.</b> ` : ''}${esc(text)}</p>` : '');

function datesText(dates) {
  if (!Array.isArray(dates) || !dates.length) return typeof dates === 'string' ? esc(dates) : '';
  if (dates.length <= 3) return dates.map((d) => esc(d)).join(', ');
  return `${dates.length} dates, ${esc(dates[0])} … ${esc(dates[dates.length - 1])}`;
}

/** A short plain-language account of the method; every value in it is read from the site's files. */
function plainMethod(b) {
  const s = b.summary || {};
  const obs = b.manifest?.observed || [];
  const base = s.baseline || {};
  const d = b.derived;
  const nOli = obs.filter((o) => /OLI/.test(o.sensor || '')).length;
  const pixel = obs[0]?.pixel_m;
  const out = [];
  if (base.start_date && base.end_date) {
    out.push(
      `We compared ${nOli || 'the'} November Landsat 8/9 panchromatic images${isNum(pixel) ? ` (${pixel} m pixels)` : ''} taken between ${esc(date(base.start_date))} and ${esc(date(base.end_date))}, and measured how far the sand patterns moved inside overlapping 480 m windows, using every pair of years. The uncertainty comes from how much ground that should not move (roads, rock, buildings) appears to move.`,
    );
  }
  if (isNum(s.detection_limit_myr)) {
    out.push(
      `Motion counts as detected only where it is clearly larger than that uncertainty: the detection limit is about ${num(s.detection_limit_myr, 2)} m/yr here${isNum(d.detectedPct) ? `, and ${num(d.detectedPct, 0)} % of dune windows pass it` : ''}. Slower windows get no arrow and no direction and are reported as “below detection limit”, never as zero.`,
    );
  }
  const pos = date(b.dunes?.features?.[0]?.properties?.position_date);
  out.push(
    `The large dunes are outlined from NASA's NASADEM elevation model (February 2000) and moved to their ${pos ? esc(pos) : 'latest'} position by the measured motion. Wind comes from NASA's MERRA-2 reanalysis, turned into sand drift potential with the Fryberger method.`,
  );
  out.push(
    'To find which roads, farms and built-up areas the moving sand reaches, each migrating sand edge is carried along its measured heading at its measured speed (fast and slow cases: speed ± 1σ). The projected images move the latest observed image the same way. Both assume the 2013–2025 motion simply continues; nothing else is modelled.',
  );
  return out.map((p) => `<p>${p}</p>`).join('');
}

export function renderDossier(root, b, { basemap }) {
  const s = b.summary || {};
  const v = s.validation || {};
  const dh = s.data_handling || {};
  const t = s.threat || {};
  const m = b.manifest || {};
  const w = b.wind || {};
  const sid = encodeURIComponent(b.id);

  const sources = b.sources
    .map(
      (x) => `<tr>
      <td><b>${esc(x.name)}</b><div class="dim">${esc(x.provider || '')}${x.version ? ` · ${esc(x.version)}` : ''}</div></td>
      <td>${esc(x.used_for || '')}</td>
      <td>${datesText(x.dates)}${x.retrieved ? `<div class="dim">retrieved ${esc(x.retrieved)}</div>` : ''}</td>
      <td>${esc(x.pixel || '')}</td>
      <td class="links">${link(x.link, 'dataset page')}${x.doi ? `<br>${link(x.doi, x.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, 'doi:'))}` : ''}</td>
    </tr>`,
    )
    .join('');

  const pub = v.published || {};
  const sec = v.second_dataset || {};
  const threatCounts = t.targets_by_type
    ? Object.entries(t.targets_by_type)
        .map(([k, c]) => `<li>${esc(k === 'building' ? 'built-up' : k)}: ${int(c.n)} targets; ${int(c.sand_at_edge_now)} sand at edge now; ${int(c.reached_by_2050)} reached by 2050; ${int(c.reached_by_2100)} by 2100; ${int(c.borders_free_sand)} border free sand</li>`)
        .join('')
    : '';

  root.innerHTML = `
  <div class="dossier-inner" role="dialog" aria-modal="true" aria-labelledby="dossier-title">
    <header class="dossier-head">
      <h2 id="dossier-title">How we know · ${esc(b.name)}</h2>
      <nav>${['method', 'sources', 'handling', 'uncertainty', 'validation', 'threat', 'limits', 'frames', 'links', 'credits'].map((a) => `<a href="#" data-jump="${a}">${a}</a>`).join('')}</nav>
      <button class="btn" data-close aria-label="Close">Close ✕</button>
    </header>
    <div class="dossier-body">
      <section id="ds-method"><h3>Method in plain language</h3>
        ${plainMethod(b)}
        <details><summary>Details from the data files</summary>
        ${para('Motion', b.vectors?.note)}
        ${para('Baseline', s.baseline?.note || (s.baseline ? `${s.baseline.start_date} to ${s.baseline.end_date}` : ''))}
        ${para('Large dunes', b.dunes?.note)}
        ${para('Targets', b.targets?.note)}
        ${para('Wind', w.note)}
        ${para('Projection', m.projection_method)}
        <p class="dim">Generated by: ${esc(s.generated_by || 'pipeline notebooks')}.</p>
        </details>
      </section>
      <section id="ds-sources"><h3>Datasets (sources.json)</h3>
        <table class="src-table"><thead><tr><th>Dataset</th><th>Used for</th><th>Dates</th><th>Pixel</th><th>Links</th></tr></thead><tbody>${sources}</tbody></table>
        ${b.sources[0]?.place ? `<p class="dim">Place: ${esc(b.sources[0].place)}</p>` : ''}
        <p class="dim">Display only (not measurements): basemap ${esc(basemap?.basemap || '')}${basemap?.terrain ? `, terrain ${esc(basemap.terrain)}` : ''}.</p>
      </section>
      <section id="ds-handling"><h3>Clouds, haze and missing data</h3>
        <ul>
          ${isNum(dh.scenes_rejected) ? `<li>${int(dh.scenes_rejected)} candidate scenes rejected</li>` : ''}
          ${dh.cloud_masking ? `<li>Cloud masking: ${esc(dh.cloud_masking)}</li>` : ''}
          ${isNum(dh.windows_rejected_pct) ? `<li>Dune windows rejected: ${pct(dh.windows_rejected_pct, 2)}</li>` : ''}
          ${m.masking ? `<li>Frames: ${esc(m.masking)}</li>` : ''}
        </ul>
        ${para('', dh.notes)}
      </section>
      <section id="ds-uncertainty"><h3>Uncertainty and the detection limit</h3>
        ${para('Speeds', s.speed_note)}
        <ul>
          ${isNum(s.detection_limit_myr) ? `<li>Detection limit (median over windows): ${num(s.detection_limit_myr, 2)} m/yr. Slower motion is shown as “below detection limit”, never as a number.</li>` : ''}
          ${isNum(s.uncertainty_myr) ? `<li>Uncertainty: ± ${num(s.uncertainty_myr, 2)} m/yr (median calibrated 1σ per component).</li>` : ''}
          ${isNum(s.speed_median_myr) ? `<li>Median detected speed ${num(s.speed_median_myr, 2)} m/yr (10–90 %: ${num(s.speed_p10_myr, 2)}–${num(s.speed_p90_myr, 2)} m/yr).</li>` : ''}
          ${isNum(s.mean_wind_agreement_deg) ? `<li>Mean |heading − RDD|: ${num(s.mean_wind_agreement_deg, 1)}°.</li>` : ''}
        </ul>
        ${para('Wind agreement', s.wind_agreement_note)}
        ${b.station?.note ? para('Ground station check', b.station.note) : ''}
      </section>
      <section id="ds-validation"><h3>Validation</h3>
        <h4>Published study (context only)</h4>
        <dl class="kv">
          ${pub.reference ? `<dt>Reference</dt><dd>${esc(pub.reference)}</dd>` : ''}
          ${pub.their_value ? `<dt>Their value</dt><dd>${esc(pub.their_value)}</dd>` : ''}
          ${pub.our_value ? `<dt>Our value</dt><dd>${esc(pub.our_value)}</dd>` : ''}
        </dl>
        ${para('', pub.note)}
        <h4>Second dataset: ${esc(sec.dataset || '')}</h4>
        <dl class="kv">
          ${sec.period ? `<dt>Period</dt><dd>${esc(sec.period)}</dd>` : ''}
          ${sec.their_value ? `<dt>Their value</dt><dd>${esc(sec.their_value)}</dd>` : ''}
          ${sec.our_value ? `<dt>Our value</dt><dd>${esc(sec.our_value)}</dd>` : ''}
        </dl>
        ${para('', sec.note)}
      </section>
      <section id="ds-threat"><h3>Threat: what “reached” means</h3>
        ${para('Definition', t.reach_definition)}
        ${para('Speeds', t.speeds)}
        ${para('Years', t.years)}
        ${Array.isArray(t.excludes) && t.excludes.length ? `<p><b>Excludes:</b></p><ul>${t.excludes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${threatCounts ? `<p><b>Counts:</b></p><ul>${threatCounts}</ul>` : ''}
      </section>
      <section id="ds-limits"><h3>Limits</h3>
        <ol class="limits">${(s.limits || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
      </section>
      <section id="ds-frames"><h3>Imagery frames</h3>
        ${para('Reading the projection', m.projection_reading_note)}
        ${para('Bounds', m.bounds_note)}
        ${para('Brightness', m.stretch?.rule)}
        ${para('Stretch quantity', m.stretch?.quantity)}
        <p class="dim">Observed frames: ${esc(m.observed_format || '')}. Projected frames: ${esc(m.projected_format || '')}. On screen, projected frames are tinted amber; the tint changes colour only, never position.</p>
      </section>
      <section id="ds-links"><h3>Notebooks and docs</h3>
        <ul>
          <li>${link(`${REPO}/blob/main/pipeline/runs/${sid}/01_scenes_and_wind.ipynb`, '01 · scenes and wind (executed, this site)')}</li>
          <li>${link(`${REPO}/blob/main/pipeline/runs/${sid}/01b_station_wind_check.ipynb`, '01b · ground-station wind check (executed, this site)')}</li>
          <li>${link(`${REPO}/blob/main/pipeline/runs/${sid}/02_tracking_and_dunes.ipynb`, '02 · tracking and dunes (executed, this site)')}</li>
          <li>${link(`${REPO}/blob/main/pipeline/runs/${sid}/03_threats_and_frames.ipynb`, '03 · threats and frames (executed, this site)')}</li>
          <li>${link(`${REPO}/blob/main/docs/how-we-know.md`, 'docs/how-we-know.md')} · ${link(`${REPO}/blob/main/docs/data-and-credits.md`, 'docs/data-and-credits.md')} · ${link(REPO, 'repository')}</li>
        </ul>
      </section>
      <section id="ds-credits"><h3>Credits</h3>
        <p><b>${esc(CREDIT_LINE)}</b></p>
        <p>Data and imagery courtesy of NASA: ${b.sources.filter((x) => /NASA/i.test(x.provider || '')).map((x) => esc(x.name)).join('; ')}. This project is not endorsed by NASA.</p>
        <p>Also used: ${b.sources.filter((x) => !/NASA/i.test(x.provider || '')).map((x) => `${esc(x.name)} (${esc(x.provider || '')})`).join('; ')}. © OpenStreetMap contributors.</p>
        <p>Basemap and terrain for display: ${esc(basemap?.basemap || '')}${basemap?.terrain ? `; ${esc(basemap.terrain)}` : ''}. Globe: CesiumJS.</p>
      </section>
    </div>
  </div>`;
}
