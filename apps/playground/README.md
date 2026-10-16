# Rivet example application

A deliberately simple file-routed app on `@rivetjs/router`: compiled JSX, Tailwind, signal state, two-way input models, keyed lists, server loaders, lazy route chunks, a client-only module and a gtag-style page-view effect. Pages are server-rendered and resumed in the browser; client navigation fetches route data from the server's data endpoint, so loaders (and guards) always run on the server.

- `src/routes/` — `_layout.tsx` (header, counter, footer; stays mounted across navigation), `index.tsx`, `items/[id].tsx`, `resume.tsx` (each with an in-file `serverLoad`), `_404.tsx`.
- Endpoints: `api/items.ts`, `api/items/[id].ts` (REST, `onGet`), `csr/…` (308 to the resumed pages).
- `src/document.ts` — document shell (site title/description defaults, icon, stylesheets).
- Hero image via `?image` + `<Picture priority>` + `<ImagePreload>` in the layout header (`src/assets/hero.jpg`, regenerate with `node apps/playground/scripts/hero.ts`); `build.ts` uses Vite's app builder (server, then client) so the server-only image variants land in `dist/client/assets`.

```sh
npm ci
node apps/playground/build.ts
npm run start:playground
```

Production listens at [http://127.0.0.1:4173](http://127.0.0.1:4173) (`PORT`, `HOST`). Pages return complete server HTML plus resume state and one inline loader (no module script); counter, filter and client navigation resume on first interaction, and links work without JavaScript. Page views ([page-views.tsx](src/page-views.tsx)) load the local [analytics](src/analytics.ts) chunk at idle and rerun on each client navigation.

```sh
npm run dev
```

Development runs Vite with the router's dev middleware: pages render on the server (without resume state), then the browser client-renders them from the embedded route data; edits to routes, layouts and components hot-replace them in place, keeping component state (no reload), loader edits apply on the next request. Resumability itself needs a production build.

## Container

```sh
docker build -f apps/playground/Dockerfile -t rivet-playground .
docker run --rm -p 8080:8080 rivet-playground
```

The image holds only `dist/` (server bundle, client assets, plain-JS HTTP server), runs as `node`, and reports health at `/healthz` (`/readyz` turns 503 while draining on `SIGTERM`).

```sh
npm run audit:playground
```

After a production build, this runs Lighthouse mobile defaults three times per resumed page (`/`, `/items/1`) using a fresh Playwright Chromium profile. Reports go to `.artifacts/playground/lighthouse`. Run audits with builds/tests and SSR load comparisons stopped.

```sh
npx nx run playground:latency
```

Document latency of the production server over loopback (Brotli negotiated): the first request after a fresh start and warm p50/p90/p99 per route. Fails when a warm p50 exceeds `LATENCY_BUDGET_MS` (default 1 ms). Run it with builds and benchmarks stopped.

`dist/artifact-sizes.json` records raw/gzip/Brotli sizes and hashes for each emitted file. See [resumability](../../docs/guides/resumability.md) for what resumes and how chunks are scheduled.
