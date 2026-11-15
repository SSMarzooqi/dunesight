// App state (site, mode, timeline position, selection, toggles) plus a tiny event emitter that modules subscribe to.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[state] listener for "${event}" failed`, err);
    }
  }
}

export const state = {
  siteId: null, // current site id
  site: null, // loaded site bundle (see data.js)
  mode: 'motion', // 'true' | 'motion' | 'threat'
  stop: null, // current timeline stop {year, kind: 'observed'|'projected', ...}
  selection: null, // {kind: 'dune'|'target'|'arrow', id, props, lonlat}
  hitRule: 'min', // 'min' = hit_year_min (fast case) | 'med' = hit_year_med
  showFast: true, // faint fast-case projected frame on top
  showChange: false, // highlight pixels changed vs the latest observed frame
  thenNow: 'now', // 'now' | 'overlay' (dunes_2000 dotted on top of dunes)
  arrowFactor: 1, // arrow-length multiplier shown in the legend
  exposed: false, // highlight targets that border free sand
  topDown: false,
};

export function set(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  emit(key, value);
  emit('change', { key, value });
}
