# Rivet roadmap

Living plan, updated 2026-10-29 (previous: 2026-10-12). Status: **done** · **in progress** · **planned** · **idea** · **dropped**. Dates = when decided. Internal design records: [`docs/CLAUDE.md`](docs/CLAUDE.md) (index of specs, plans, research, benchmarks).

## 0. North star

- **Beat every peer ≥ 1.3×**: Razor, Solid, Svelte, React, Qwik on SSR (CPU/page, p50, TTFB, peak memory), DOM (mount, update, heap) and resume (click / navigate to interactive). Measured, same harness, published with losses ([`perf-scoreboard`](docs/benchmarks/perf-scoreboard.md), [`2026-10-28 SSR comparison`](docs/benchmarks/2026-10-28-ssr-comparison.md)).
- **Static pages at zero JS**: pages with nothing interactive ship no JS (Astro parity). Static pages and static docs frames now ship 0 JS (STATIC-ZERO slice 1, 2026-10-23); native automata (switch / checkbox / accordion / Button / Table) ship 0 JS where the build proves the call site closed.
- **Little JS before the first input**: real app pages ship 3.5–4.8 KB in 1 request before input (was 25.7 KB / 4 requests; Solid 1: 7.5–7.9 KB / 1) ([`real pages`](docs/benchmarks/2026-10-28-real-pages-jsdiet.md)).
- **Dynamic at static cost**: a dynamic page should cost what a static file costs. Last editorial run (2026-10-11): 0.294 vs 0.092 ms CPU/req → not yet; rerun due ([`editorial`](docs/benchmarks/2026-10-11-editorial.md)).
- **Adoption**: a framework + ui kit people pick for apps, admin tools, AI apps, content sites (mobile apps later); docs, homepage, `npm create rivet@latest`, AI tooling (MCP, skills, llms.txt).
- **Where we stand (2026-10-28 SSR comparison)**: static Rivet wins every metric except HTML bytes (5000 rows c1: 367 req/s vs Razor 84, Solid 1 static 129); the resumable lane no longer loses on CPU or p99. Losses: peak memory vs Qwik 1 (×1.67), HTML bytes vs Solid's hydratable output, krausest bytes vs Solid.

## 1. Now (week of 2026-10-26)

| Item | Status | Links / notes |
| --- | --- | --- |
| Peak SSR memory vs Qwik (the last SSR metric we lose) | in progress — SSR-MEM 2026-10-29: 1000 rows 837 → 729 KB/page, RSS 318 → 302 MiB, no leak (peak = V8 garbage high-water); next: ~40 fixed per-request router objects (~46 KB/request) | [2026-10-28 SSR comparison](docs/benchmarks/2026-10-28-ssr-comparison.md) |
| First input on router pages | done 2026-10-29 (ROUTER-PRIME): the idle prime runs `Root.ready`; first click slow 4G 181 → 14–18 ms, fast 31 → 15 ms, 0 requests after the click (cost: +1 eager request on nested-layout pages) | [router-prime](docs/benchmarks/2026-10-29-router-prime.md) |
| Release `0.1.0-alpha.2` on `latest` (`npm create rivet@latest` picks it up) | in progress 2026-10-29 — through `release.yml` (repository public: Actions run, npm provenance on) | `scripts/CLAUDE.md` "Release" |
| GitHub CI | repository public since 2026-10-29: Actions run again; first green run pending | `.github/workflows/ci.yml` |
| Lane harness (launch / watch / retry / intake for agent lanes) | designed — spec uncommitted, two questions open | `docs/design/specs/2026-10-28-lane-harness-design.md` |
| Framework bridges: Vue / Svelte / Solid adapters | planned — React 19 (T6) + Preact (T8) adapters, server protocol, client driver, Vite integration, islands-only lean client done; Vue / Svelte / Solid bytes measured only | [spec](docs/design/specs/2026-10-11-framework-bridges-design.md) · `libs/bridge/CLAUDE.md` |
| Codebase regroup: runtime into directories, then split `compile.rs` | planned | — |

## 2. Next

| Item | Status | Links / notes |
| --- | --- | --- |
| Backend recipes (db / queues / Kafka / gRPC / Docker / workers): 10 runnable `examples/` apps tested without Docker in CI + router helpers (server entries, lifecycle hooks, env, SSE) + docs section — **high priority** | planned — design done (2026-10-12) | [spec](docs/design/specs/2026-10-12-backend-examples-design.md) · [plan](docs/design/plans/2026-10-12-backend-examples.md) |
| AI streaming adapter: `createChat` over AI SDK UI-message stream / OpenAI-compatible SSE → signals, wired to the chat components + router actions | planned (P0 in the Pro research) | [research](docs/design/research/2026-10-12-pro-components.md) |
| Floor-first, remaining: op-stream writer in Node (X2), native template sequences (X2′), native host only if X2 < 2× (X4) | planned — X1 + dictionary transport (X3) + origin zstd done 2026-10-22 | [research](docs/design/research/2026-10-18-floor-first.md) · [dictionary transport](docs/benchmarks/2026-10-22-dictionary-transport.md) |
| Editorial rerun ("dynamic at static cost") after STATIC-ZERO, route cache and dictionary transport | planned | [editorial](docs/benchmarks/2026-10-11-editorial.md) |
| PERF-GAPS list (2026-10-11 scout): CSS-INLINE, PRERENDER-FAST, EARLY-HINTS, MULTICORE, INCR-PRERENDER, CONTENT-MD, LH-CI + DEV-BENCH | planned — not re-audited since; ROUTE-CACHE, CSS-SPLIT, LOADER-DIET work landed in other lanes | PERF-GAPS report (lane scratch) |
| Pro components, remaining P1: tags input, confirm `await`, `rivet add` block registry | planned | [research](docs/design/research/2026-10-12-pro-components.md) |
| HeroUI Pro gaps: FileTree sections (cdk `TreeSection` SSR), PromptInput Queue drag reorder | in progress — lane PRO-LAST (2026-10-29) | `libs/cdk/tree/CLAUDE.md` · `libs/ui/CLAUDE.md` |
| cdk / ui API wave 2: naming review outcome (T10), controlled / uncontrolled symmetry | planned (R4: targeted, no mass rename) | [ui-identity spec §4](docs/design/specs/2026-10-11-ui-identity-design.md) |
| uWebSockets.js adapter: default or not | idea — experimental; pilot 1.08–1.31× < 1.3× bar (2026-10-11) | `libs/router/adapters/uws.ts` |

## 3. Later

| Item | Status | Notes |
| --- | --- | --- |
| Backend-agnostic rendering: one portable template IR, executors in Rust / Go / C# / Python / Node, three server tiers | idea — P1 measured: app code 72–100 % portable, widget libraries 15–25 % → sidecar needed; rulings R-F–R-H pending | [research](docs/design/research/2026-10-18-backend-agnostic.md) |
| Server functions (gap N-11): `serverFn({ input, guards }, fn)`, generated browser stub, `POST /_rivet/fn/<id>`, strict CSRF, Standard Schema input, `formFn` | designed — deferred by the user 2026-10-22 | [spec](docs/design/specs/2026-10-22-server-functions-design.md) · [plan](docs/design/plans/2026-10-22-server-functions.md) |
| Mobile apps (Ionic alternative) — `@rivetjs/mobile`: iOS / MD modes, nav stack, Capacitor bridge, mobile template | parked (user 2026-10-12: "not the priority"); spec + plan only | [spec](docs/design/specs/2026-10-12-mobile-design.md) · [plan](docs/design/plans/2026-10-12-mobile.md) |
| Launch: dev.to post (one post, "React inside Rivet"), docs redeploy | planned — waits for the user | `docs/blog/dev-to/` |
| Stability contract: resume ABI + public API freeze, semver, deprecation policy (ends "breaking changes allowed") | planned — at first real users | rule 2026-10-06 |
| Adapters: Vercel (+ ISR, Edge), Netlify, Cloudflare Workers, Bun, Deno, static, csr | done (exist); per-platform CI smoke planned | `libs/router/adapters/` |
| Pro components P2 / P3: heatmap / tracker charts, tour, phone input, schema form, agent console, nprogress, ecommerce blocks; P3 ideas: pivot / export, voice, workflow canvas, signature | idea | [research](docs/design/research/2026-10-12-pro-components.md) |
| Rich text editor (slash menu, drag handle, mentions, tables, collaboration); engine choice in its own spec | idea — "not now" (2026-10-11) | — |
| Reverse bridges (Rivet components inside React / Vue apps; multi-root resume) | idea | [bridges spec §10](docs/design/specs/2026-10-11-framework-bridges-design.md) |
| Ecosystem: public Vite plugin + `@rivetjs/nx` docs, community ports / registries, VS Code marketplace | planned | `libs/nx`, `apps/vscode` |

## 4. Done since 2026-10-12

| Item | Landed | Links / notes |
| --- | --- | --- |
| Derived client: the only resume model (M6 cut, serialized runtime / lowering / options deleted); parity: bridges, forms progressive enhancement, streamed `Suspense`, non-JSON `resource` values, `intent` cold presses | 2026-10-22 … 10-28 | [research](docs/design/research/2026-10-18-beyond-resume-hydration.md) · [`resumability.md`](docs/guides/resumability.md) |
| Static pages ship 0 JS; native automata (ZERO STATESPACE) and native Button for proven `onPress` (PRESS-LITE) | 2026-10-23 … 10-28 | [`resumability.md`](docs/guides/resumability.md) "Native automata" |
| JS before first input 25.7 → 3.5–4.8 KB (JS-DIET-2); first input in its own task (LITE-BOOT); router idle prime (ROUTER-PRIME) | 2026-10-28 … 10-29 | [real pages](docs/benchmarks/2026-10-28-real-pages-jsdiet.md) · [lite-boot](docs/benchmarks/2026-10-29-lite-boot.md) |
| Compression Dictionary Transport (RFC 9842) + origin zstd / precompressed files; route rules + page cache (`@rivetjs/router/route-cache`) | 2026-10-22 | [dictionary transport](docs/benchmarks/2026-10-22-dictionary-transport.md) · `libs/router/CLAUDE.md` |
| Build-time evaluation (`comptime`: tailwind-variants tables, static variant classes); tailwind-merge only where an override needs it | 2026-10-25 … 10-28 | `libs/compiler/CLAUDE.md` |
| Framework bridges: protocol, client driver, Vite integration, React 19 + Preact adapters, islands-only lean client; bridge demo + islands bench | 2026-10-12 … 10-28 | [spec](docs/design/specs/2026-10-11-framework-bridges-design.md) · `apps/bridge-demo`, `apps/island-bench` |
| `@rivetjs/motion` (T1–T18): `<Motion.*>`, Presence, layout FLIP, scroll / in-view, CSS entrances with 0 JS | 2026-10-11 … | [spec](docs/design/specs/2026-10-11-motion-design.md) |
| Motion harmony: every ui / cdk transition on a role token (state / move / collapse / indicator / popup / enter-exit / overlay); mobile sidebar sheet = Drawer | 2026-10-29 | `libs/ui/styles/CLAUDE.md` "Motion" |
| UI identity: per-component CSS split, concentric radii, Rivet theme + presets, TWEAKS log; HeroUI v3 port: 0 open demo gaps (Slider steps / marks, `Avatar.Image render` closed 2026-10-29) | 2026-10-12 … 10-29 | [spec](docs/design/specs/2026-10-11-ui-identity-design.md) · `apps/ui-docs/CLAUDE.md` "Gaps" |
| Pro components P0 / P1 / P2 (clean-room, public docs): command palette, drop zone, context menu, hover card, chart wave (area / bar / line / pie / radar / radial / composed), kanban (+ keyboard moves, selection), tree + file tree (+ drag and drop), timeline, KPI / rating / trend chip / empty state, item cards, list view, floating TOC, holo card, QR code, status, scheduler / agenda, PromptInput token input, AI chat kit; showcases (dashboard, chat, finance, mail, music, pricing, settings, storefront, auth) | 2026-10-12 … 10-29 | [research](docs/design/research/2026-10-12-pro-components.md) · `libs/ui/CLAUDE.md` |
| Scheduler / agenda (port of malva: month / week / day, drag, resize, server-final layout) | 2026-10-23 | [spec](docs/design/specs/2026-10-12-scheduler-design.md) · [bench](docs/benchmarks/2026-10-23-scheduler.md) |
| Homepage redesign on `@rivetjs/ui`; diagnostic pages `/errors/RVxxxx`; DIAG-VERBOSE warnings | 2026-10-19 … 10-27 | `apps/docs/CLAUDE.md` |
| Docs: zero-JS guide, CLI reference, CI build cache, own examples for stub pages; cdk-docs page sweep; quarantined examples 0 on all three sites | 2026-10-28 … 10-29 | `apps/*/CLAUDE.md` |
| Builds: ui-docs peak RSS 3.1 → 2.43 GB; warm rebuild 156 → 103 s (build caches outside the project); Cloudflare docs builds skip example checks (CI gates them); starters type-check with tsgo (TypeScript 7) | 2026-10-28 … 10-29 | `scripts/CLAUDE.md` · README "Documentation hosting" |
| npm `0.1.0-alpha.0` (`latest`) / `alpha.1` (`next`) | 2026-10-16 / 10-21 | `scripts/CLAUDE.md` "Release" |

Dropped with the derived model (2026-10-22): Function Bridge phases 1 / 2 (no functions on the wire; class values via `registerClass`), ROW-ABI, RESUME-ROWS-REMOVE, preload strategies (`preload`, `ChunkGroup` have no effect), STRUCT-PREFETCH.

## 5. Not planned

| Item | Why |
| --- | --- |
| Emoji picker | ruling 2026-10-11; needs a large dataset + licence check; editors ship emoji menus as plug-ins |
| Map component | ruling 2026-10-11; map engine ~1 MB (MapLibre), lowest value / effort |
| cdk / ui repo split | ruling 2026-10-09; monorepo stays until go-live (nx affected + CODEOWNERS instead) |
| React dependency (in ui, motion or anywhere in runtime) | Rivet compiles its own JSX; React only behind framework bridges, per island |
| Second visual theme | ruling R6 2026-10-11; one Rivet theme + presets (variables only) |
| Native Rust render target | spike 2026-10-06: 2.9–3.3× proto ceiling, dropped ([report](docs/benchmarks/2026-10-06-rust-ceiling-spike.md)) |
| Resumable static subtrees (RESUME-COMPILE) | rejected 2026-10-09: ceiling 1.03–1.20× < 1.3× bar ([spec](docs/design/specs/2026-10-09-resume-static-subtrees-design.md)) |
| Build-time click prediction (running handlers at build time) | parked 2026-10-26 on branch `experiment/predict-build-clicks`; state is predicted only from compiler proofs |

## 6. How we decide

- **Perf first**: every runtime / compiler change is measured (ssr-bench, dom-bench, resume-bench, size-report); no semantic trades (dev guards, guarantees) for bytes; speed over size.
- **Land measured non-regressions**: no percentage threshold (2026-10-11); big bets need ≥ 1.3× to become defaults.
- **Docs follow code**: every API / behaviour change updates docs, llms.txt outputs, AGENTS / CLAUDE.md, skills, MCP data in the same change (CI `--check`).
- **Zero-cost**: an unused feature costs 0 bytes; every `@rivetjs/*` subpath tree-shakes; `scripts/zero-cost` gates it.
- **Live props by default**: a prop is live when the caller passes a reactive value; literals are static.
- **cdk headless, ui = own identity** (similar look and API to HeroUI, improved); upstream behaviour + ported tests are the floor.
- **Clean-room Pro**: HeroUI Pro-inspired components from public docs only (names, anatomy); own code, CSS, content; lucide icons.
- **One motion language**: same role = same duration and easing token everywhere.
- **Breaking changes allowed** until real users; every in-repo consumer migrates in the same change.
