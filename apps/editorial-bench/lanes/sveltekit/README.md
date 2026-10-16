# editorial-bench lane: sveltekit

- Versions: `@sveltejs/kit` 3.0.1, `svelte` 5.57.2, `@sveltejs/vite-plugin-svelte` 7.3.1, `@sveltejs/adapter-static` 4.0.0, `vite` 8.3.4, `marked` 18.1.0.
- `build.sh <fixture dir>`: `vite build` → adapter-static `dist/`. Kit 3: config passed to `sveltekit({...})` in `vite.config.js` (no `svelte.config.js`), `$lib` replaced by relative imports.
- `prerender = true`, `trailingSlash = "always"`, `entries()` per dynamic route; default CSR kept (hydration JS + inline data); `data-sveltekit-preload-data` removed from `app.html` (no prefetch). `csr = false` would make it zero-JS (not measured).
