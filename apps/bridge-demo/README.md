# Bridges demo: Next 16 vs Rivet islands

Same React 19 dashboard twice:

- `next/`: Next 16.4.0 App Router.
- `rivet/`: Rivet file routes rendering the same React components as islands (`@rivetjs/bridge-react`).

The dashboard has three routes:

- `/`: KPI cards, recent orders and a recharts revenue chart.
- `/orders`: TanStack Table over 500 orders, with a Radix Dialog detail.
- `/orders/new`: react-hook-form + zod order form.

Results: [`docs/benchmarks/2026-10-12-bridges-demo.md`](../../docs/benchmarks/2026-10-12-bridges-demo.md). Spec: [`docs/design/specs/2026-10-12-bridges-demo.md`](../../docs/design/specs/2026-10-12-bridges-demo.md).

## Result (timed run 2026-10-12 / 13, loaded host)

The components are the same in both lanes. The difference is framework code that runs before the first input:

- Next: 58.3 KB, plus 6.8 KB of router code in its user-menu chunk.
- Rivet: 0.7 KB with lean pages, or 37.3 KB with the full resume driver.

Total JS executed before the first input, against Next (gzip est. KB):

| route | Rivet (lean) | Next | ratio |
| --- | ---: | ---: | ---: |
| `/` | 170.0 | 239.0 | 0.71× |
| `/orders` | 94.9 | 162.3 | 0.58× |
| `/orders/new` | 93.2 | 160.6 | 0.58× |

With the full resume driver the ratio is 0.77–0.84×. The rest is React and your libraries:

| chunk holds | `/` | `/orders` | `/orders/new` |
| --- | ---: | ---: | ---: |
| React (Rivet / Next) | 66.9 / 70.3 | 66.9 / 70.3 | 66.9 / 70.3 |
| route library (Rivet / Next) | recharts 101.2 / 102.5 | TanStack + Radix 26.1 / 25.7 | rhf + zod 25.1 / 24.7 |
| framework, fetched (Rivet / Next) | 33.8 / 58.3 | 33.8 / 58.3 | 33.8 / 58.3 |

"Half the JS" is not reachable on this app. With zero framework bytes, React plus the route's libraries are still 0.58–0.71× of Next's total.

With document prefetch on (the default), Rivet also downloads its runtime at low priority after the page loads, without running it. That keeps the first navigation on par with Next (Fast 3G 1.79 vs 1.73 s). With prefetch off, the first navigation pays for that download and is 1.9× slower than Next without prefetch (3.28 vs 1.73 s).

The server renders each page with 2–5.6× less CPU than Next (c1 and c10, per-request SSR, no compression, localhost).

Lighthouse (mobile preset, Playwright headless shell, n = 3) scores Rivet 100 on every route against Next's 81–96, with a 3.2–5.7× better simulated LCP (Next's own `/orders/new` value varied between runs: 4.1 then 2.9 s). Observed LCP against Next was not measured. The lean page starts its island code only after the first paint, so Lighthouse's simulation no longer counts it against first paint; the full resume driver is level on two routes and 1.2× ahead on `/orders/new`.

Full tables, including every loss: [`docs/benchmarks/2026-10-12-bridges-demo.md`](../../docs/benchmarks/2026-10-12-bridges-demo.md).

## What we did to be fair to Next

1. **One `"use client"` boundary per component** (`next/app/_client/*.jsx`). With a single barrel file, Next put every client component into one chunk, so every route loaded all of them.
2. **Data passed as serialized props in both lanes.** The Rivet pages read their data in `load(…)`. Before this change, a module-level import resumed by reference, and the client rebuilt the seed data instead of receiving it, which is not what Next does.
3. **Idiomatic defaults on both sides.** Next uses `<Link>` with its default prefetch. Rivet uses `prefetch: "document"` with per-island `client` policies. Each lane also has a no-prefetch row, and Rivet has an all-`load` control row.
4. **Same pinned library versions in both lanes.** The run checks the versions and validates the rendered markup before timing anything.
5. **Production builds on both sides, with compression off on both servers.**
6. **Same host and Node 26.5.1 for both, lanes interleaved.** Next ships its own vendored React build: 70.3 vs 66.9 KB.

Inline scripts are counted as page bytes, not as JS chunks. That is Rivet's boot and records (about 7 KB) and Next's RSC payload (up to 83 KB).

## Run

See [CLAUDE.md](CLAUDE.md) for commands, lanes and invariants.
