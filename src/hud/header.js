// HUD header: DuneSight brand, site switcher, mode buttons, OBSERVED/PROJECTED badge with year, view buttons and the dossier button.
import { state, set, on } from '../state.js';
import { esc } from '../format.js';
import { shortName } from '../data.js';

const MODES = [
  ['true', 'True view', 'Imagery frame, large dunes, targets dimmed'],
  ['motion', 'Motion', 'Measured motion arrows coloured by speed'],
  ['threat', 'Threat', 'Targets by threat status, ranked list of reached targets'],
];

export function createHeader(root, { sites, onSite, onHome, onTopDown, onDossier }) {
  root.innerHTML = `
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span>DuneSight<small>dune motion · UAE</small></div>
    <nav class="sites" aria-label="Site">${sites
      .map((s) => `<button class="seg" data-site="${esc(s.id)}" title="${esc(s.name)}">${esc(shortName(s.name || s.id))}</button>`)
      .join('')}</nav>
    <span class="placeholder-badge" hidden title="Some files for this site are placeholders, not results">placeholder data</span>
    <nav class="modes" aria-label="Mode">${MODES.map(([id, label, tip]) => `<button class="seg" data-mode="${id}" title="${tip}">${label}</button>`).join('')}</nav>
    <div class="badge" aria-live="polite"><span class="badge-kind">—</span><span class="badge-year"></span></div>
    <div class="view-btns">
      <button class="btn" data-act="home" title="Home view of the site box">Home</button>
      <button class="btn" data-act="topdown" title="Map-like top-down view" aria-pressed="false">Top-down</button>
      <button class="btn btn-accent" data-act="dossier" title="Method, sources, validation and limits">How we know</button>
    </div>`;

  root.querySelectorAll('[data-site]').forEach((b) => b.addEventListener('click', () => onSite(b.dataset.site)));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => set('mode', b.dataset.mode)));
  root.querySelector('[data-act="home"]').addEventListener('click', onHome);
  root.querySelector('[data-act="topdown"]').addEventListener('click', () => onTopDown(!state.topDown));
  root.querySelector('[data-act="dossier"]').addEventListener('click', onDossier);

  const syncSite = () => root.querySelectorAll('[data-site]').forEach((b) => b.classList.toggle('on', b.dataset.site === state.siteId));
  const syncMode = () => root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  const syncTop = () => {
    const b = root.querySelector('[data-act="topdown"]');
    b.classList.toggle('on', state.topDown);
    b.setAttribute('aria-pressed', String(state.topDown));
  };
  on('siteId', syncSite);
  on('mode', syncMode);
  on('topDown', syncTop);
  syncSite();
  syncMode();

  return {
    setStop(stop) {
      const badge = root.querySelector('.badge');
      badge.className = `badge ${stop?.kind || ''}`;
      root.querySelector('.badge-kind').textContent = stop ? (stop.kind === 'observed' ? 'OBSERVED' : 'PROJECTED') : '—';
      root.querySelector('.badge-year').textContent = stop ? String(stop.year) : '';
    },
    setPlaceholder(bundle) {
      const el = root.querySelector('.placeholder-badge');
      el.hidden = !bundle.placeholder;
      if (bundle.placeholder) el.title = `Placeholder files for this site: ${bundle.placeholderFiles.join(', ') || 'see sites.json'}`;
    },
    setLoading(siteId, loading) {
      const b = root.querySelector(`[data-site="${CSS.escape(siteId)}"]`);
      b?.classList.toggle('loading', loading);
    },
  };
}
