---
name: rivet-bench
description: Use when a Rivet change claims or risks a performance delta (SSR CPU/TTFB/RSS, DOM mount/update, resume click-to-interactive, shipped bytes) — which bench to run, how to keep numbers honest, and where results go.
---

# Rivet benchmarks

Perf first: every runtime / compiler change is justified by measurement; no semantic trades for bytes. Land every measured non-regression (no % threshold).

## Which bench

| Claim | Bench |
| --- | --- |
| Server CPU / page, TTFB, p50, peak RSS | `apps/ssr-bench` (Docker, Python 3.12; Rivet vs Solid / Qwik / Razor / React lanes) + `scripts/real-app-prof/run.ts` |
| DOM mount / update / heap | `apps/dom-bench` (krausest + Rivet scenarios; writes `docs/benchmarks/perf-scoreboard.md`) |
| Style / layout / paint cost | `apps/dom-bench/render/` |
| Realistic pages (headline: listing / dashboard / form / docs; bytes, CPU, LCP, TBT, input-to-paint) | `apps/resume-bench --suite real` (`real-pages/`) |
| Cold click-to-interactive (micro: counter, 1,000-row fixture) | `apps/resume-bench` |
| Shipped bytes | `npm run size-report -- --check`, `node scripts/size-report/frames.mjs --check` |
| Islands / bridges | `apps/island-bench`, `apps/bridge-demo` |
| Static / editorial sites | `apps/editorial-bench` |

Read the app's CLAUDE.md before running; comparison toolchains are pinned in `apps/bench-stable`.

## Honest numbers

- Base vs change on the same host, same session, interleaved runs (A B A B), ≥ 3 repeats; report median + spread.
- Note host load (1-min load avg) beside numbers; don't wait for a quiet host, but timing-critical lanes run alone or last.
- Report small AND large cases (one-button page AND ≥ 100-element fully interactive page); per-site overhead must stay O(live sites).
- Never touch the user's Docker containers; benches use their own compose project names and ports 4400+.
- Results: raw under `.artifacts/<bench>/<date>-<sha>/` (gitignored); write-up `docs/benchmarks/<date>-<topic>.md`; command that produced each number in the write-up.
