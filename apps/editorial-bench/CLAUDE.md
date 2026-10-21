# apps/editorial-bench

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Editorial-site benchmark: the same generated news site (N = 100 / 1000 / 5000 Markdown articles + index pagination + tag / author pages + related rail) built by Rivet (static prerender), Astro, Eleventy, Hugo, Next.js (static export) and SvelteKit (adapter-static), served by ONE shared static server; plus `rivet-dynamic` (same app, node adapter, per request). Methodology + fairness rules + deviations: [README.md](README.md). Write-up: `docs/benchmarks/2026-10-11-editorial.md` (+ `.json` = copy of `results/results.json`).

## Layout

- `fixture/gen.ts` — seeded generator → `fixture/content/n<N>/{site.json, content/articles/*.md}` (gitignored; `run.ts` generates a missing N). `fixture/load.mjs` — shared front matter reader + listing helpers for rivet / next / sveltekit / astro (Eleventy + Hugo parse natively). `fixture/site.css`, `fixture/assets/photo-{1..4}.jpg` (copies of ui-docs `cover-*.jpg`).
- `lanes/<lane>/` — `package.json` + `package-lock.json` (isolated, NOT npm workspaces: `apps/*` only matches one level), `build.sh <abs fixture dir>`, `README.md` (versions, setup). Gitignored per lane: `node_modules`, `dist`, generated `public` / `static` / `data` / caches. Site roots: rivet `dist/client`, others `dist`.
  - `rivet` resolves `@rivetjs/*` + Vite from the repo root; only `marked` is local. `build.sh <dir> server` → `dist-dynamic/` + `serve-dynamic.js` (rivet-dynamic; `EDITORIAL_ROUTE_CACHE=1` adds `routeRules: { "/**": { swr: 60 } }` = target `rivet-dynamic-cached` in the dynamic phase: router page cache, hits skip the render — 2026-10-12, 1000 articles: 0.023 ms CPU/req (fix round 1; 0.025 at 25810dd4) vs 0.348 uncached, 0.100 static).
  - `hugo` — `hugo-extended` npm wrapper; binary install: `node node_modules/hugo-extended/postinstall.js` (official gohugoio release, SHA-256 checked) when npm install scripts are disabled.
- `harness/` — isolated deps (lighthouse 13.5.0, chrome-launcher, serve-static, compression, finalhandler): `static-server.mjs <root> <port>` (shared server, gzip), `lh.mjs` (`runLighthouse(url, chromePath)`, mobile preset). Chromium = the repo's Playwright build.
- `spikes/ppr-shell/` — PPR-T01 T0 harness (shell share for partial prerendering, spec `docs/design/specs/2026-10-20-ppr-shell-design.md` §4): `app/` = a Vite router app (server mode) reusing the rivet lane's `content.ts` + `Markdown` with a signed-in user menu (`sid` cookie → `session.ts` loader): `/full/articles/<slug>/` (today's signed-in page), `/stub/articles/<slug>/` (user menu = constant same-shape placeholder, no request read), `/hole/<slug>/` (the user menu alone), `/floor/`, `/shell/articles/<slug>/` (PPR-T23: the `full` page under route rule `shell: { maxAge: 3600, query: false }`, user menu = a deferred layout loader under `<Async fallback>`; lane `shell` = warm store, signed in (asserts `SHELL-HIT`); lane `deferred` = the same page with `?bypass=1`, no store; PPR-T6: lane `shell` = H-holes hit (asserts exactly `SHELL-HIT`: no shell render), `shell-h` = the same hits on H-replay (PPR-T3B muted replay, test hook `{ replay: true }`, asserts `SHELL-HIT-REPLAY`), `shell-full` = replayed in full (test hook `{ full: true }`, T3's cost); cached-loader variant (T0 caveat: shell loader ≈ 0): `/fullc/articles/<slug>/` + `/shellc/articles/<slug>/` (`app/src/cached.ts` memoises the article per slug; rule `/shellc/**` like `/shell/**`), lanes `full-cached` / `shell-cached` / `shell-cached-h` (H-replay)); `bench.ts [--build] [--rounds 5] [--requests 1500] [--pages editorial,resume] [--lanes a,b] [--rows 1000] [--json out] [--dump <lane>]` renders them in-process through `loadBuild` (+ the same components compiled in-process into the byte writer / a no-op writer, the loader alone, a prefix copy) and the ssr-bench `/resume` page (lazy-cost source: full / shell / rows) → CPU / wall / TTFB / bytes per lane, interleaved, + H-replay / H-holes estimates. Fixture: `fixture/content/n1000` (`EDITORIAL_CONTENT`). Build output `app/.artifacts/`, `app/.rivet/` (gitignored). PPR-T57 HTTP pair: `serve.ts` (node adapter `start`, 127.0.0.1:4413, `app/.artifacts/dist`) + `loadgen.ts [--build] [--rounds 3] [--seconds 5] [--targets full,shell,shell-h,floor] [--max-load 8] [--json out]` (closed loop over `apps/ssr-bench/loadgen/client.ts` `Connection`, `sid` cookie on every request, c1 + c10, 2 s warm-up + 64-request `x-rivet-cache` check (≥ 63), `shell-h` = a second server with `RIVET_SHELL_HOLES=0`; req/s, p50 / p99, TTFB, server CPU/req, RSS) → `docs/benchmarks/2026-10-21-ppr-shell.md`. `RIVET_RESUME_MODEL=derived` (DERIVED-C3) builds / serves the app with the derived resume model (`app/vite.config.ts` knob, output `app/.artifacts/dist-derived`; `bench.ts`, `loadgen.ts`, `serve.ts`) → `docs/benchmarks/2026-10-21-derived-c.md` §C3. Not in `run.ts`.
- `run.ts` — phases `build,output,serve,dynamic` → `results/results.json` (merged across invocations) + `results/report.md` (tables + WIN/TIE/LOSE verdict, ≥ 1.1×). Flags: `--n`, `--lanes`, `--runs`, `--serve-n` (1000), `--max-load` (8), `--lh-runs`, `--nav-runs`, `--load-seconds`, `--out`, `--as <key>` (store results under a variant key, e.g. `NEXT_CPUS=2 … --lanes next --as next-cpus2`; the next lane reads `NEXT_CPUS` → `experimental.cpus`). `EDITORIAL_BENCH_LOCK=<bench-lock.sh>` → takes the host bench lock (lane `EDITORIAL`) around timed phases.

## Rules / invariants

- Every lane renders the same URLs and the same element structure; `run.ts` output phase compares the visible text of 20 article pages per lane with rivet ("content parity" column) — a lane edit that changes text is a bug.
- Same Markdown library (marked 18.1.0, pinned in every JS lane); Hugo = Goldmark with highlighting / typographer / heading ids off.
- No prefetch, image pipelines, fonts or islands in any lane; framework defaults otherwise (Rivet: static mode, `clientRouter` default off → the article / listing pages resume nothing and ship zero JS, no `_data.json`, scripts pruned — since STATIC-ZERO-JS 2026-10-12; before: resume loader + client router + `_data.json`; Next React runtime + RSC payloads, SvelteKit hydration).
- Ports: 4411 (static server), 4412 (rivet-dynamic). Never 4320–4329.
- Build samples: a run is void when the 1-min load at its start > `--max-load`; RSS = `ps` tree sum every 50 ms max'd with `/usr/bin/time -l`; > 2.8 GB tree → killed (`over-cap`), > 20 min → `timeout`.

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
for l in apps/editorial-bench/lanes/* apps/editorial-bench/harness; do (cd $l && npm ci --workspaces=false); done
node apps/editorial-bench/fixture/gen.ts
node apps/editorial-bench/run.ts                       # agent hosts: bash $S/heavy.sh … with EDITORIAL_BENCH_LOCK set
bash apps/editorial-bench/lanes/<lane>/build.sh $PWD/apps/editorial-bench/fixture/content/n100   # one lane
```

## Gotchas

- Rivet lane content module is `src/content.ts`, not `content.server.ts` (historical): with rolldown 1.2.12 the router's server-only guard fired at random on a route importing a `.server.ts` module — rolldown `PluginContext.resolve` keys its `custom` options by `resolveOptionsMap.size`, so concurrent resolves lost the compiler's fact-resolution marker. Fixed 2026-10-11 (compiler `_factsResolve` registry, see `libs/compiler/CLAUDE.md`); renaming back to `content.server.ts` is now safe.
- SvelteKit 3 rejects `svelte.config.js` and `$lib` (config goes into `sveltekit({...})`).
- Eleventy honours `.gitignore` by default: the lane calls `setUseGitIgnore(false)` because `src/articles/` is a gitignored build copy.
- Next.js `output: "export"` writes `out/` regardless of `distDir`; `build.sh` moves it to `dist/`.
- Next.js 16 default build workers (CPUs − 1) exceed the 2.8 GB tree cap at N ≥ 1000 on a 14-core host; `NEXT_CPUS=2` fits (≈ 1.9 GB at 5000).
