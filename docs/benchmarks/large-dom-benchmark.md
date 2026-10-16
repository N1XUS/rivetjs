# Large browser workload

The runnable benchmark compares production Rivet DOM, React DOM, and separate stable/preview Solid lanes on identical HTML and independently reactive fields. It supplements the Docker SSR benchmark; client timings cannot establish a server performance win.

```sh
npm ci
npm run build:dom-bench
npm run bench:dom -- --rows 100,1000,5000 --repeats 3 --samples 5 --out .artifacts/dom-bench/latest
npm run bench:dom:report -- .artifacts/dom-bench/latest/results.json
```

Chromium must be installed for Playwright (`npx playwright install chromium`). Open the generated `report.html` to compare results; `results.json` contains individual samples, source/bundle hashes, exact installed versions, and environment details. Use a quiet machine without simultaneous builds, tests, or other load.

Each row contains 57 native HTML elements, ten field components, and ten working buttons. At 5,000 rows this is 285,001 elements and 50,000 independently reactive values. All rows remain mounted; there is no virtualization. React uses field-local `useState`, so sparse updates do not deliberately rerender the entire application. Rivet uses its JSX DOM compiler; Solid 2 uses its production DOM compiler; Solid 1 uses its compatible production Babel preset. Solid 1.9.15 and Solid 2.0.0-rc.13 are pinned separately, with stable toolchains isolated in `apps/bench-stable`. Versions were checked against the npm registry on 2026-10-04. Qwik is compared in the SSR and resumability harnesses: its asynchronous updates do not satisfy this harness's synchronous-commit contract. Bundle sizes include the fixture and its imported runtime; they are not runtime-only package sizes.

Updates change an evenly distributed 1%, 10%, or 100% of fields. Each update is synchronous and committed before the clock stops (`batch`, `flushSync`, Solid 2 `flush`, or Solid 1 synchronous signals). Every field is validated after each operation, and representative element/text identity is checked. The runner also checks real button clicks, repeatable mount/disposal, and an empty host after disposal. Any failure invalidates the run.

In-page `performance.now()` measures committed DOM wall time. Chromium's `TaskDuration` with `threadTicks` separately measures main-thread task CPU, including evaluation/instrumentation bookkeeping. GPU and worker CPU are excluded. Forced layout and two animation-frame callbacks are measured separately; frame settling is not a direct paint metric. Fresh contexts and rotating framework order reduce order bias. Three repeated trials with five samples per update size are exploratory evidence, not statistical significance or universal framework rankings.

Memory is Chromium's forced-GC JavaScript heap: warmed empty baseline, mounted page, disposed page, then five mount/dispose cycles. This does not measure browser process RSS, native DOM storage, or all engine allocations. A flat retained heap is useful evidence but cannot prove that all application lifetimes are leak-free. Module/template caches remain intentionally alive. Lighthouse scores on the small playground are excluded from performance conclusions.

The [2026-10-04 performance comparison](performance-next-comparison.md) includes stable Solid, current SSR/resumability results, before/after Rivet measurements, and the remaining client performance gaps.
