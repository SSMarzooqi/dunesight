// Timeline model: the stops for a site (every observed scene, then every year to 2050) with the frames to draw at each; the bar and its controls are drawn by the UI (src/ui/ui.js).

export const END_YEAR = 2050;

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
