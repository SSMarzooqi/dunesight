// Credits footer: the exact grant line, NASA datasets named from sources.json, OpenStreetMap and basemap credits, and the Cesium credit display.
import { esc } from '../format.js';

export const CREDIT_LINE = 'Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.';

/** Short dataset names for the one-line footer (full names are in the dossier's Credits section). */
function shortName(name) {
  const n = String(name);
  if (/^Landsat 7/i.test(n)) return 'Landsat 7 ETM+';
  if (/^Landsat 8-9/i.test(n)) return 'Landsat 8-9 OLI';
  if (/HLSS30/.test(n)) return 'HLS S30';
  if (/HLSL30/.test(n)) return 'HLS L30';
  if (/^MERRA-2/i.test(n)) return /aer/i.test(n) ? 'MERRA-2 aerosol' : 'MERRA-2 wind';
  if (/^NASA POWER/i.test(n)) return 'NASA POWER';
  if (/^NASADEM/i.test(n)) return 'NASADEM';
  if (/^NOAA Integrated Surface/i.test(n)) return 'NOAA ISD (station wind)';
  return n.split(' (')[0];
}

/** True when a sources.json entry is provided by NASA (providers such as "European Space Agency (not NASA)" are not). */
export const isNasa = (s) => /NASA/.test(s.provider || '') && !/not NASA/i.test(s.provider || '');

export function renderCredits(root, sources, basemap) {
  const nasa = sources.filter(isNasa);
  const other = sources.filter((s) => !isNasa(s) && !/openstreetmap/i.test(s.name || ''));
  const osm = sources.some((s) => /openstreetmap/i.test(s.name || ''));
  root.querySelector('.credit-line').textContent = CREDIT_LINE;
  root.querySelector('.credit-data').innerHTML = [
    nasa.length ? `Data and imagery: NASA (${nasa.map((s) => esc(shortName(s.name))).join(', ')})` : '',
    other.map((s) => esc(shortName(s.name))).join(', '),
    osm ? '© OpenStreetMap contributors' : '',
    basemap ? `Basemap: ${esc(basemap.basemap)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  root.querySelector('.credit-data').title = sources.map((s) => `${s.name} (${s.provider || ''})`).join('\n');
}
