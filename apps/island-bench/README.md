# island-bench

Framework islands in Rivet (`@rivetjs/bridge-react`) against Astro + React, Next.js and the same page written natively in Rivet; Preact pair (T8): Rivet + `@rivetjs/bridge-preact` against Astro + Preact.

## Page

Same in every lane, from the same sources (`data.ts`, `components/*.react.tsx`, `site.css`):

- header: React counter, hydrated on load (`client="load"` / `client:load` / a Next client component) + a static React badge (no client JS anywhere);
- 1000-row list rendered on the server (Rivet / Astro / React Server Components);
- React month picker, hydrated on idle;
- React SVG bar chart below the fold, hydrated when visible (Next: a client component, hydrated with the page).

`rivet-native` renders the same markup from Rivet components and resumes (no hydration): it is the ceiling, the price of reusing React code is the difference.

The Preact pair uses `components/*.preact.tsx`: the same four components (same markup, `class` instead of `className`) on `preact/hooks`.

## Lanes

| lane | stack | server |
| --- | --- | --- |
| `rivet-bridge-react` | Rivet + `@rivetjs/bridge-react` (React 19.3.0) | `serve-rivet.ts` (hand-written node:http: streaming `renderResumable`, writes batched per `setImmediate`, static assets from memory with `cache-control: no-store`; not a framework server) |
| `astro-react` | Astro 7.3.8, `@astrojs/react` 7.0.1, `@astrojs/node` 11.1.7 standalone, React 19.3.0 | `dist/server/entry.mjs` |
| `next` | Next.js 16.4.0 App Router (Turbopack build), React 19.3.0, `force-dynamic` | `next start` |
| `rivet-native` | Rivet only | `serve-rivet.ts` |
| `rivet-bridge-preact` | Rivet + `@rivetjs/bridge-preact` (Preact 11.0.1; cross-version vs Astro) | `serve-rivet.ts` |
| `rivet-bridge-preact-p10` | the same page and adapter on Preact 10.29.8 + preact-render-to-string 6.8.0 from the astro-preact install (same version as Astro) | `serve-rivet.ts` |
| `astro-preact` | Astro 7.3.8, `@astrojs/preact` 6.0.6, `@astrojs/node` 11.1.7 standalone, Preact 10.29.8 (the integration's peer range is `^10`) | `dist/server/entry.mjs` |

## Metrics

- **Server** (`run.ts --phases server`): closed-loop keep-alive HTTP client in the runner process, c1 and c10, `--rounds` interleaved rounds of `--seconds` each (1.5 s warm-up), median: requests/s, TTFB p50 (first body byte), complete p50, server CPU per page (process-tree CPU time delta / requests, `ps`); peak server RSS = max over rounds (tree, sampled every 200 ms). No lane compresses responses. `NODE_ENV=production` in every lane (build + server).
- **Browser** (`--phases browser`): Playwright Chromium, a fresh context per sample, lanes interleaved, `--repeats` samples, median; conditions `fast3g` (CDP Fast 3G: 562.5 ms RTT, 1.44 Mbps down, 675 kbps up + 4× CPU) and `unthrottled`:
  - bytes, JS bytes and JS requests before the first input: raw = CDP `encodedDataLength` (as transferred, response headers included: per-request header overhead differs by lane) and a gzip -6 estimate of the response bodies only — two different kinds, compare within a kind;
  - script CPU until network idle (`ScriptDuration`, = hydration / resume boot);
  - CLS (layout-shift entries without recent input);
  - first input → paint per island: click capture timestamp → the expected DOM text (MutationObserver) → next frame. Counter: first click after load (in the Rivet lanes Rivet handlers take the first-click deferral, spec §3.7; the bridge lane's React handlers do not); picker: a day click; chart: scroll into view, wait for its code, click a bar.
  - one discarded warm-up visit per lane and condition; every selected lane's server runs during the whole phase.
- **Build** (`--phases build`): wall time, peak RSS of the largest process (`/usr/bin/time -l`) and of the process tree (`ps` samples).

Deviations from the plan: the server load generator and the browser harness are this app's own (in-process, Playwright + CDP), not the ssr-bench / resume-bench harnesses (those are tied to their fixed lanes); no `package.json` for the app (Rivet lanes resolve from the repo root, Astro has its own install, Next reuses the editorial-bench lane's install); the shared components are imported by relative path instead of a symlinked folder.

## Run

See [CLAUDE.md](CLAUDE.md) "Commands". Result: `docs/benchmarks/2026-10-12-islands.md`.
