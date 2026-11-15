// Imagery-frame layer: drapes the manifest's observed Landsat frames and stone-tinted projected frames (the projected colour) on the globe inside the exact frame bounds, with cross-fades and an optional changed-pixel overlay.
import * as Cesium from 'cesium';
import { dataUrl } from '../data.js';
import { MAP_STYLE } from '../ui/ui.js';

const FADE_MS = 320;
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const STONE = hexRgb(MAP_STYLE.projected); // projected = stone, as in the legend and the timeline
const DARK = [21, 19, 15];

export function createFramesLayer(viewer, bundle) {
  const scene = viewer.scene;
  const layers = viewer.imageryLayers;
  const m = bundle.manifest || {};
  const b = m.bounds || bundle.bbox;
  const rectangle = Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north);
  const observed = m.observed || [];
  const latest = observed[observed.length - 1] || null;

  const blobUrls = new Map(); // file -> Promise<objectURL> (raw file)
  const variants = new Map(); // key -> Promise<objectURL> (tinted / change)
  const layerCache = new Map(); // key -> ImageryLayer
  const current = { base: null, med: null, fast: null, change: null }; // role -> {key, layer, target}
  let visible = true;
  let lastChangeStats = null;

  function fetchBlobUrl(file) {
    if (!blobUrls.has(file)) {
      const p = fetch(dataUrl(bundle.dir + file))
        .then((r) => {
          if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
          return r.blob();
        })
        .then((blob) => URL.createObjectURL(blob));
      p.catch(() => blobUrls.delete(file));
      blobUrls.set(file, p);
    }
    return blobUrls.get(file);
  }

  async function decode(file) {
    const url = await fetchBlobUrl(file);
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return { canvas: c, ctx, data: ctx.getImageData(0, 0, c.width, c.height) };
  }

  /** Stone-tinted copy of a projected grey+alpha PNG (tint only: geometry and grey levels untouched). */
  function tinted(file) {
    const key = `tint:${file}`;
    if (!variants.has(key)) {
      variants.set(
        key,
        decode(file).then(({ canvas, ctx, data }) => {
          const d = data.data;
          for (let i = 0; i < d.length; i += 4) {
            const g = d[i] / 255;
            d[i] = STONE[0] * g;
            d[i + 1] = STONE[1] * g;
            d[i + 2] = STONE[2] * g;
          }
          ctx.putImageData(data, 0, 0);
          return new Promise((res) => canvas.toBlob((bl) => res(URL.createObjectURL(bl)), 'image/png'));
        }),
      );
    }
    return variants.get(key);
  }

  /**
   * Pixels of a projected frame whose grey level differs from the latest observed frame by more than 10 levels
   * (the manifest's own change statistic), keeping only pixels with at least 3 such neighbours so isolated
   * JPEG-compression noise in the observed frame is not shown as change.
   */
  function changeMask(file) {
    const key = `change:${file}`;
    if (!variants.has(key)) {
      variants.set(
        key,
        Promise.all([decode(file), decode(latest.file)]).then(([proj, base]) => {
          const w = proj.data.width;
          const h = proj.data.height;
          const pd = proj.data.data;
          const bd = base.data.data;
          const raw = new Uint8Array(w * h);
          if (base.data.width !== w || base.data.height !== h) throw new Error('frame sizes differ');
          for (let i = 0, j = 0; j < raw.length; i += 4, j++) raw[j] = pd[i + 3] > 0 && Math.abs(pd[i] - bd[i]) > 10 ? 1 : 0;
          const out = proj.ctx.createImageData(w, h);
          const o = out.data;
          let n = 0;
          let nRaw = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const j = y * w + x;
              if (!raw[j]) continue;
              nRaw += 1;
              let nb = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (!dx && !dy) continue;
                  const yy = y + dy;
                  const xx = x + dx;
                  if (yy >= 0 && yy < h && xx >= 0 && xx < w && raw[yy * w + xx]) nb += 1;
                }
              }
              if (nb >= 3) {
                o[j * 4] = STONE[0];
                o[j * 4 + 1] = STONE[1];
                o[j * 4 + 2] = STONE[2];
                o[j * 4 + 3] = 240;
                n += 1;
              }
            }
          }
          // dark edge around the changed patches so the stone reads on bright sand (the map's casing rule)
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const j = y * w + x;
              if (o[j * 4 + 3]) continue;
              let edge = false;
              for (let dy = -1; dy <= 1 && !edge; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const yy = y + dy;
                  const xx = x + dx;
                  if (yy >= 0 && yy < h && xx >= 0 && xx < w && o[(yy * w + xx) * 4 + 3] === 240) {
                    edge = true;
                    break;
                  }
                }
              }
              if (edge) {
                o[j * 4] = DARK[0];
                o[j * 4 + 1] = DARK[1];
                o[j * 4 + 2] = DARK[2];
                o[j * 4 + 3] = 170;
              }
            }
          }
          lastChangeStats = { file, sharePct: (100 * n) / (w * h), rawSharePct: (100 * nRaw) / (w * h) };
          proj.ctx.putImageData(out, 0, 0);
          return new Promise((res) => proj.canvas.toBlob((bl) => res(URL.createObjectURL(bl)), 'image/png'));
        }),
      );
    }
    return variants.get(key);
  }

  function getLayer(key, urlPromise) {
    if (!layerCache.has(key)) {
      const provider = urlPromise.then((url) => Cesium.SingleTileImageryProvider.fromUrl(url, { rectangle }));
      const layer = Cesium.ImageryLayer.fromProviderAsync(provider, { rectangle, alpha: 0, show: false });
      layer.errorEvent?.addEventListener((e) => console.warn(`[frames] could not load ${key}`, e?.message || e));
      layers.add(layer);
      layerCache.set(key, layer);
    }
    return layerCache.get(key);
  }

  // --- fades ---------------------------------------------------------------------------------
  const fades = new Set();
  let raf = 0;
  function fadeTo(layer, target, onDone) {
    for (const f of fades) if (f.layer === layer) fades.delete(f);
    fades.add({ layer, from: layer.alpha, to: target, t0: performance.now(), onDone });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    for (const f of [...fades]) {
      const t = Math.min(1, (now - f.t0) / FADE_MS);
      f.layer.alpha = f.from + (f.to - f.from) * t;
      if (t >= 1) {
        fades.delete(f);
        f.onDone?.();
      }
    }
    scene.requestRender();
    raf = fades.size ? requestAnimationFrame(tick) : 0;
  }

  const ORDER = ['base', 'med', 'fast', 'change'];
  function setRole(role, key, urlPromiseFn, alpha) {
    const cur = current[role];
    if (!key) {
      if (cur) {
        const old = cur.layer;
        fadeTo(old, 0, () => {
          if (current[role]?.layer !== old) old.show = false;
        });
        current[role] = null;
      }
      return;
    }
    if (cur && cur.key === key) {
      if (Math.abs(cur.target - alpha) > 1e-3) {
        cur.target = alpha;
        fadeTo(cur.layer, visible ? alpha : 0);
      }
      cur.layer.show = visible;
      return;
    }
    const layer = getLayer(key, urlPromiseFn());
    layer.show = visible;
    layer.alpha = 0;
    current[role] = { key, layer, target: alpha };
    fadeTo(layer, visible ? alpha : 0);
    if (cur) {
      const old = cur.layer;
      // keep the old frame underneath until the new one has faded in
      setTimeout(() => {
        if (![...Object.values(current)].some((c) => c?.layer === old)) {
          old.alpha = 0;
          old.show = false;
          scene.requestRender();
        }
      }, FADE_MS + 150);
    }
  }

  function restack() {
    for (const role of ORDER) {
      const c = current[role];
      if (c) layers.raiseToTop(c.layer);
    }
  }

  // Preload all frame files in the background so the timeline (and offline use) runs from memory.
  const allFiles = [...observed.map((o) => o.file), ...(m.projected_median || []).map((p) => p.file), ...(m.projected_fast || []).map((p) => p.file)].filter(Boolean);
  const preload = (async () => {
    const queue = [...allFiles];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          await fetchBlobUrl(f);
        } catch (err) {
          console.warn('[frames] preload failed', f, err.message);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  })();

  return {
    rectangle,
    preload,
    /**
     * @param {{base: object|null, med: object|null, medAlpha: number, fast: object|null, fastAlpha: number, change: boolean}} v
     */
    show(v) {
      setRole('base', v.base?.file ? `raw:${v.base.file}` : null, () => fetchBlobUrl(v.base.file), 1);
      setRole('med', v.med?.file ? `tint:${v.med.file}` : null, () => tinted(v.med.file), v.medAlpha);
      setRole('fast', v.fast?.file ? `tint:${v.fast.file}` : null, () => tinted(v.fast.file), v.fastAlpha);
      setRole('change', v.change && v.med?.file && latest ? `change:${v.med.file}` : null, () => changeMask(v.med.file), 1);
      restack();
      scene.requestRender();
    },
    setVisible(v) {
      visible = v;
      for (const c of Object.values(current)) {
        if (!c) continue;
        c.layer.show = v;
        c.layer.alpha = v ? c.target : 0;
      }
      scene.requestRender();
    },
    changeStats: () => lastChangeStats,
    /** What each role (base, med, fast, change) is showing now: the layer key or null. */
    roles: () => Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v ? v.key : null])),
    dispose() {
      for (const layer of layerCache.values()) layers.remove(layer, true);
      for (const p of [...blobUrls.values(), ...variants.values()]) p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    },
  };
}
