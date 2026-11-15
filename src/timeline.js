// Timeline model: the stops for a site (every observed scene and display-only image in year order, then every year to 2050) with the frames to draw at each; the bar and its controls are drawn by the UI (src/ui/ui.js).

export const END_YEAR = 2050;

/** Timeline stops for a site: every observed frame, then every projected year to 2050. */
export function buildStops(manifest) {
  const obs = (manifest?.observed || []).filter((o) => Number.isFinite(o.year)).sort((a, b) => a.year - b.year);
  const med = (manifest?.projected_median || []).filter((p) => Number.isFinite(p.year)).sort((a, b) => a.year - b.year);
  const fast = (manifest?.projected_fast || []).filter((p) => Number.isFinite(p.year)).sort((a, b) => a.year - b.year);
  const latest = obs[obs.length - 1] || null;
  // display-only images (Landsat 7 after the 2003 scan-line-corrector failure): a stop with a frame, never a measurement
  const disp = (manifest?.observed_display_only || []).filter((o) => Number.isFinite(o.year) && o.file && !obs.some((x) => x.year === o.year));
  const stops = [...obs.map((o) => ({ year: o.year, kind: 'observed', frame: o })), ...disp.map((o) => ({ year: o.year, kind: 'display', frame: o }))]
    .sort((a, b) => a.year - b.year);
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
  const years = stops.filter((s) => s.kind !== 'projected').map((s) => s.year);
  const gaps = [];
  for (let i = 1; i < years.length; i++) {
    if (years[i] - years[i - 1] > 1) gaps.push([years[i - 1] + 1, years[i] - 1]);
  }
  return { stops, gaps, first: years[0] ?? 2000, latest, med, fast, display: disp };
}
