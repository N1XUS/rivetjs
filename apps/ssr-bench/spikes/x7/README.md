# Lane ZERO X7 harness (THROWAWAY measurement tools)

Numbers and verdict: `docs/benchmarks/2026-10-26-x7-static-server.md`. Not in `build.ts` / zero-cost / typecheck gates.
Delete when no longer needed. Run from the repo root with Node ≥ 24.

- `cold-build.mjs <repo> <out>` — the codex "server-scale" pages (N instances of the docs examples two-way-input =
  `greeting`, show-hide = `details`) rebuilt from this tree: production Vite build + router `renderDocument`
  (`<label>.ordinary-resume.mjs`) and the bare `renderToString` floor (`<label>.ordinary.mjs`).
- `cold-run.sh <out> <label> <n> [rounds]` — median of isolated `cold-worker.mjs` processes per mode: CPU / wall ms per
  page (output consumed as Buffer + SHA-256 inside the timer, the codex method), process maxRSS, bytes, hash.
- `pages.mjs` — in-process page CPU over a built router app (`loadBuild(dist).handler`): `cpu <iters> <path>…`,
  `all <out.json>` (every prerendered page), `shas <out.json>` (normalised body sha per page), `- a.json b.json` compare.
- `ceiling.mjs <repo>` — static-heavy synthetic page: plain / derived / static children inlined by hand / one constant.
- `prof.mjs <file.cpuprofile>` — self time + category buckets (record walk, escape, encode, derived, gc, …).

```sh
node apps/ssr-bench/spikes/x7/cold-build.mjs $PWD /tmp/x7-cold && zsh apps/ssr-bench/spikes/x7/cold-run.sh /tmp/x7-cold greeting 1000
node apps/ssr-bench/spikes/x7/pages.mjs $PWD apps/docs/dist cpu 200 / /guides/deploy/node/ /about/benchmarks/
LOOP=8000 node --cpu-prof --cpu-prof-dir=/tmp/p apps/ssr-bench/spikes/x7/pages.mjs $PWD apps/docs/dist cpu 20 /guides/deploy/node/
node apps/ssr-bench/spikes/x7/prof.mjs /tmp/p/*.cpuprofile
```
