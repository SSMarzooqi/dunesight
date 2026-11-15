# server/ — optional local proxy (not used yet)

There is no server code here, on purpose. DuneSight runs as a static Vite app, and the only key it uses, the Cesium ion token (`VITE_CESIUM_TOKEN`), is public by design and protected by URL restrictions in Cesium ion.

This folder is reserved for a small Node/Express proxy, God's Eye View–style, **only if** a secret-key API is added later (for example api.nasa.gov or an LLM API). The pattern would be:

- the server reads its keys from the repo-root `.env` (names without the `VITE_` prefix, so Vite never bundles them);
- the app calls `/api/...`, and `vite.config.js` proxies that path to the server in dev (`server.proxy`);
- secret keys never go in `src/` or in any variable prefixed `VITE_`.

GitHub Pages cannot run a server, so any feature that depends on this proxy works only locally.
