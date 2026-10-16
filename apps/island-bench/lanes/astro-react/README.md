# island-bench lane: astro-react

- Pins (exact, `package.json` + `package-lock.json`): `astro` 7.3.8, `@astrojs/react` 7.0.1, `@astrojs/node` 11.1.7, `react` / `react-dom` 19.3.0. Install: `npm ci --workspaces=false --ignore-scripts` in this folder (`node_modules` gitignored).
- `output: "server"` + `@astrojs/node` standalone (`dist/server/entry.mjs`, no compression); the shared React components with `client:load` (counter), `client:idle` (picker), `client:visible` (chart), the badge without a directive (static HTML).
- `build.sh` exits 3 when not installed (`run.ts` skips the lane with the install command).
