# island-bench lane: astro-preact

- Pins (exact, `package.json` + `package-lock.json`): `astro` 7.3.8, `@astrojs/preact` 6.0.6 (latest before Astro 7.3.8; peer `preact` `^10`, so this lane runs Preact 10), `@astrojs/node` 11.1.7, `preact` 10.29.8. Install: `npm ci --workspaces=false --ignore-scripts` in this folder (`node_modules` gitignored; ≈ 151 MB, 267 packages: `@astrojs/preact` pulls `@preact/preset-vite` + `@preact/signals`).
- `output: "server"` + `@astrojs/node` standalone (`dist/server/entry.mjs`, no compression); the shared Preact components (`components/*.preact.tsx`) with `client:load` (counter), `client:idle` (picker), `client:visible` (chart), the badge without a directive (static HTML). `vite.resolve.dedupe: ["preact"]`: the components live outside the lane, so `preact` must resolve from here (one copy).
- `build.sh` exits 3 when not installed (`run.ts` skips the lane with the install command).
