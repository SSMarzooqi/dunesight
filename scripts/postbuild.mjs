// After `vite build`: undo a vite-plugin-cesium base-path quirk. With a base other than '/', the plugin copies Cesium's
// static files to dist/<base>/cesium/ while the built page loads them from <base>cesium/, i.e. dist/cesium/ on the server.
// Move them to dist/cesium/ and remove the then-empty dist/<base>/ folders. With DS_BASE=/ they are already in place.
import fs from 'node:fs';
import path from 'node:path';
import { prodBase } from './base.mjs';

const base = prodBase();
const dist = 'dist';
const segments = base.split('/').filter(Boolean);
const misplaced = path.join(dist, ...segments, 'cesium');

if (segments.length === 0) {
  console.log(`postbuild: base ${base}, Cesium assets already in ${dist}/cesium (nothing to move)`);
} else if (fs.existsSync(misplaced)) {
  fs.rmSync(path.join(dist, 'cesium'), { recursive: true, force: true });
  fs.renameSync(misplaced, path.join(dist, 'cesium'));
  for (let i = segments.length; i > 0; i--) {
    const dir = path.join(dist, ...segments.slice(0, i));
    if (fs.readdirSync(dir).length) throw new Error(`postbuild: ${dir} is not empty after moving Cesium assets`);
    fs.rmdirSync(dir);
  }
  console.log(`postbuild: moved ${misplaced} -> ${dist}/cesium (vite-plugin-cesium base-path quirk, base ${base})`);
}

if (!fs.existsSync(path.join(dist, 'cesium', 'Workers'))) throw new Error(`postbuild: ${dist}/cesium/Workers missing (base ${base})`);
