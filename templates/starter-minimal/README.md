# Rivet minimal starter

One page and one piece of state, no styling tools.

```sh
npm install
npm run dev     # dev server
npm run build   # HTML in dist/client
npm run check   # Rivet compiler diagnostics + tsc (CI)
```

## Next steps

- Edit `src/routes/index.tsx`: the page and its state (`signal`). `npm run dev` reloads it.
- Add a page: a new file in `src/routes/` (`about.tsx` → `/about`). Docs "File routes" (`guides/routing/file-routes`).
- Deploy: `npm run build`, then upload `dist/client` to any static host (docs "Deploy", `guides/deploy/static-hosts`).
- Learn the model: docs "Signals" (`learn/signals`), "Resuming" (`learn/resuming`), "Server first" (`learn/server-first`).
- Docs: https://github.com/N1XUS/rivetjs/tree/main/apps/docs/content (guides, reference, recipes).

## Tooling

- Node.js 24 or newer (`engines` in `package.json`).
- `npm run check` runs `rivet sync` (writes the gitignored `.rivet/` route types + editor manifest from `vite.config.ts`; also run it before `tsc` on a fresh clone), `rivet-check` the Rivet compiler's diagnostics (browser globals read during server rendering, handlers that cannot resume, …) for every `.tsx` file of `tsconfig.json`, then `tsc` (types, incl. typed route links: a `Link` path that matches no route is TS2820). Exits 1 on an error; use it in CI.
- `@rivetjs/devtools` is a dev dependency, so `npm run dev` shows the DevTools panel (Alt+Shift+R or the round **R** button). Builds never include it. Turn it off with `rivetRouter({ devtools: false })`.
- `tsconfig.json` lists `@rivetjs/typescript-plugin`: editors that use the project's TypeScript show compiler errors while you type. `tsc` ignores the entry.
- `vite.config.ts` passes options to `rivetRouter()`: `mode`, `styles`, `resume`, `devtools`, `dev.resume`, `transitions`, … All options: the docs page "Configuration" (`reference/config`).
