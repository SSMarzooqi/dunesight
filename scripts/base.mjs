// Production base path, from DS_BASE (default '/dunesight/', the GitHub Pages project site; '/' for a custom domain).
// Used by vite.config.js (build and preview), scripts/postbuild.mjs and playwright.config.js, so all three agree.

export const DEFAULT_BASE = '/dunesight/';

/** The validated production base: starts and ends with '/', plain path segments only. Throws on a bad value. */
export function prodBase(value = process.env.DS_BASE) {
  const base = value === undefined || value === '' ? DEFAULT_BASE : value;
  if (!/^\/([A-Za-z0-9._~-]+\/)*$/.test(base) || base.split('/').some((s) => s === '.' || s === '..')) {
    throw new Error(`DS_BASE must start and end with '/' and contain only plain path segments (e.g. '/' or '/dunesight/'), got ${JSON.stringify(value)}`);
  }
  return base;
}
