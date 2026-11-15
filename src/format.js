// Number, unit, range, compass-point, date and year formatting in one place, so nothing prints "null", "undefined" or "NaN".

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Fixed decimals, or null when the value is not a finite number. */
export function num(v, digits = 2) {
  if (!isNum(v)) return null;
  const s = v.toFixed(digits);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; // never print "-0.00"
}

/** Integer with thousands separators. */
export function int(v) {
  if (!isNum(v)) return null;
  return Math.round(v).toLocaleString('en-US');
}

/** "0.67 m/yr" */
export function speed(v, digits = 2) {
  const s = num(v, digits);
  return s === null ? null : `${s} m/yr`;
}

/** "0.44–1.14 m/yr" */
export function range(lo, hi, unit = '', digits = 2) {
  const a = num(lo, digits);
  const b = num(hi, digits);
  if (a === null || b === null) return null;
  return `${a}–${b}${unit ? ` ${unit}` : ''}`;
}

/** "12.3 m", or "0 m" for zero. */
export function metres(v, digits = 1) {
  if (!isNum(v)) return null;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)} km`;
  return `${v.toFixed(digits)} m`;
}

export function km2(v) {
  if (!isNum(v)) return null;
  if (v < 0.1) return `${(v * 100).toFixed(1)} ha`;
  return `${v.toFixed(2)} km²`;
}

export function pct(v, digits = 1) {
  const s = num(v, digits);
  return s === null ? null : `${s} %`;
}

const POINTS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassPoint(deg) {
  if (!isNum(deg)) return null;
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return POINTS16[i];
}

/** "83° (E)" */
export function heading(deg) {
  if (!isNum(deg)) return null;
  return `${Math.round(((deg % 360) + 360) % 360)}° (${compassPoint(deg)})`;
}

/** Year or null. */
export function year(v) {
  return isNum(v) ? String(Math.round(v)) : null;
}

/** HTML-escape text from data files before inserting it into markup. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "2025-11-08" -> "8 Nov 2025" (dates in the files are ISO, UTC). */
export function date(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${+m[3]} ${months[+m[2] - 1]} ${m[1]}`;
}

/** Plain words for target threat_status values; unknown values are de-snake-cased. */
export function statusWords(status) {
  const map = {
    sand_at_edge_now: 'Sand at edge now',
    reached_by_2050: 'Reached by 2050',
    reached_2051_2100: 'Reached 2051–2100',
    possible_within_direction_uncertainty: 'Possible within direction uncertainty',
    not_reached_by_2100: 'Not reached by 2100',
  };
  if (map[status]) return map[status];
  if (typeof status !== 'string') return null;
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function typeWords(type) {
  return { road: 'Road segment', farm: 'Farm / plantation', building: 'Built-up area' }[type] || (type ? String(type) : null);
}

/** Build "<dt>label</dt><dd>value</dd>" rows, skipping rows whose value is empty. Values are trusted HTML. */
export function rows(pairs) {
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`)
    .join('');
}
