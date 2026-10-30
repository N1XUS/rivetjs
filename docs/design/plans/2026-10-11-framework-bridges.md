# Framework bridges (islands) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- React 19 / Preact / Vue 3.5 / Svelte 5 / Solid 1.9 components used as JSX tags in Rivet `.tsx`.
- Server-rendered into Rivet's stream, Suspense segments included. Static by default; hydrated by a `client` policy that maps onto Rivet's preload planner + `clientEffect when:`.
- Props live and resumable, callbacks through the Function Bridge, Rivet children / named slots that stay resumable, nested islands, `persist` across navigations.
- 0 B for apps and pages without islands.

**Architecture:**
- The bridge Vite plugin resolves foreign imports in Rivet-owned modules to generated **facades**. A facade is a virtual Rivet `.tsx` module: `export const X = (props) => _island(props, ISLAND_X)`.
- `@rivetjs/bridge` core: island protocol, slots, client driver, persistence.
- Per-framework adapters `@rivetjs/bridge-<fw>` implement `{ render, head? }` (server) and `{ hydrate, mount, update, unmount }` (client).
- No Rust compiler changes: the API is the foreign tag plus a `client` prop, typed by a JSX `LibraryManagedAttributes` hook.

**Tech Stack:** TypeScript (Node 26, vitest node + Chromium browser projects, resume harness `libs/runtime/tests/resume/harness.ts`), Vite 8.3 (rolldown), `react`/`react-dom` 19.3.0, `preact` 10.x/11.0.1 + `preact-render-to-string` 6.8.0, `vue` 3.5.43, `svelte` 5.57.2, `solid-js` 1.9.17 + `vite-plugin-solid` 2.11.14 (all MIT). Framework Vite plugins: `@vitejs/plugin-react`, `@preact/preset-vite`, `@vitejs/plugin-vue`, `@sveltejs/vite-plugin-svelte`.

**Spec:** [`docs/design/specs/2026-10-11-framework-bridges-design.md`](../specs/2026-10-11-framework-bridges-design.md) (§ numbers below refer to it; Q1–Q3 ruled 2026-10-12, spec §11: order React → Preact + Solid → Vue → Svelte, docs-only setup first, `Island` → `ChunkGroup` rename = first commit of T1).

## Global Constraints

- **Zero-cost** (root CLAUDE.md):
  - every `@rivetjs/bridge*` subpath is independently tree-shakeable, `sideEffects: false`;
  - the core never imports an adapter; a facade imports exactly one;
  - nothing in a runtime entry imports dev / devtools code (`data-rf` / `data-rc` / `__rivetBridgeDev` dev-only);
  - apps without foreign imports keep byte-identical hashes for every existing package (`scripts/zero-cost/check.sh`: report your lines, do not `--update` others' baselines);
  - Rivet-only pages in an app with islands: byte-identical HTML / state / preload list vs a no-bridge build (fixture check, T16);
  - runtime additions (`server-markup`, `_rPreload`, `when` display-contents fix) are pay-per-use: intended deltas listed in the T2 commit.
- **Peer deps, pinned ranges** (one major each); dev deps exact:

  | Package | Peer | Dev (exact) |
  | --- | --- | --- |
  | `@rivetjs/bridge-react` | `react` + `react-dom` `>=19.0.0 <20`, `@vitejs/plugin-react` `>=6.0.0 <7` (optional; 6.x = Vite 8 line, T1 finding) | 19.3.0 |
  | `@rivetjs/bridge-preact` | `preact` `>=10.29.0 <12`, `preact-render-to-string` `>=6.7.0 <7` | 11.0.1 / 6.8.0 |
  | `@rivetjs/bridge-vue` | `vue` `>=3.5.0 <4` | 3.5.43 |
  | `@rivetjs/bridge-svelte` | `svelte` `>=5.20.0 <6` | 5.57.2 |
  | `@rivetjs/bridge-solid` | `solid-js` `>=1.9.0 <2`, `vite-plugin-solid` `>=2.11.0 <3` | 1.9.17 |

  - CI matrix per adapter: floor + latest of the range (T16).
  - **Downloads:** ask permission in chat before every `npm install` (filename / package / size), one ask per task.
- **No Rust edits.** None expected. If one turns out necessary, write a patch file (unified diff + what / why + verify steps) to the orchestrator's patch queue and print `PATCH READY`, per the compiler rule in force.
- **Icons:** lucide via `@rivetjs/kit/icon` only (examples, docs, devtools). Never invented SVG paths, never UTF glyphs.
- **Resumability rules** (`docs/guides/resumability.md`):
  - facades and `@rivetjs/bridge` `.tsx` capture only `_rFn` / `_rMod` / `_rProps`-resumable values;
  - `.ts` modules never import `@rivetjs/runtime/dom`.
- **Live props:** every island prop is live (value or getter) unless documented in `libs/bridge/CLAUDE.md` with the reason (`client`, `persist`: read once).
- **Perf first:** each task records its measured numbers (bytes min / br, ms, CPU / page) in the commit body. Land every behaviour-identical non-regression (no threshold, ruling 2026-10-11).
- **RAM / CPU rules** (`$S/perf/IMPL-COMMON.md`, binding; `S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad`):
  - heavy commands via `bash $S/heavy.sh …` (**2 slots** for this lane);
  - vitest always `--maxWorkers=1`;
  - ≤ 3 GB peak RSS for the whole process tree (native incl.);
  - timed runs under `bash $S/perf/bench-lock.sh acquire BRIDGES "<purpose>"` + release trap.
- Env: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH`; zsh (quote globs, `setopt nullglob` or `find`); `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; absolute paths from the repo root. Never touch user WIP (`apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `*-tmp.ts`).
- **Docs follow code:** every task updates `libs/bridge*/CLAUDE.md` (+ touched dirs' CLAUDE.md: runtime, compiler, router, language-core, devtools, nx, create-rivet). T17–T18 cover user docs, llms, MCP, AI files. No stale description at the end.
- **Shared-file rule.** Commit own paths only, through a temp index. Shared files: `vitest.config.ts`, root `package.json` / lockfile, `scripts/zero-cost/*.txt` + `packages-hashes.mjs`, `scripts/size-report.mjs`, `scripts/check-tsx-projects.ts`, `scripts/package/*`, `libs/runtime/{jsx-runtime.ts,server-resume.ts,dom-resume.ts,package.json,CLAUDE.md}`, `libs/compiler/{vite.ts,codes.json,CLAUDE.md}`, `libs/language-core/explain.json`, `docs/CLAUDE.md`, `apps/docs/content/_nav.ts`.
  - Edit in place only; blob = `git show HEAD:<file>` + own hunks, built immediately before commit;
  - `git read-tree HEAD` in the same command as `update-index`;
  - after the commit, `git diff --stat HEAD~1 HEAD` shows only your files.
- Every commit message ends with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

Gate block (per task, as applicable):

```bash
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
bash $S/heavy.sh npx vitest run --project bridge --project bridge-browser --maxWorkers=1      # + bridge-<fw>[-browser]
NX_DAEMON=false npx nx run bridge:typecheck --output-style=static --skip-nx-cache            # + touched projects
bash $S/heavy.sh sh scripts/zero-cost/check.sh   # runtime + lanes identical (except listed deltas), dev leaks none, condition parity ok, corpus match
npm run size-report -- --check                   # when runtime / compiler bytes may change (T2, T5, T16)
npx prettier --write <own files>
```

Commit recipe:

```bash
export GIT_INDEX_FILE=$S/idx-BRIDGES-$$; git read-tree HEAD; git add -- <own new/clean files>
# shared file: git show HEAD:<p> > $S/b.tmp; apply own hunks; git update-index --cacheinfo 100644,$(git hash-object -w $S/b.tmp),<p>
git commit -m "<message>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
unset GIT_INDEX_FILE; git diff --stat HEAD~1 HEAD; git show --name-only --format= HEAD | xargs git reset -q --
```

## File Structure

| File | Responsibility | Tasks |
| --- | --- | --- |
| `libs/bridge/{package.json,project.json,tsconfig.json,CLAUDE.md,NOTICE}` | `@rivetjs/bridge` manifest (`rivet.source: true`), nx targets, notes | T1 |
| `libs/bridge/adapter.ts` | `ServerAdapter` / `ClientAdapter` / `IslandContext` / `SlotMark` types, `defineAdapter` | T3 |
| `libs/bridge/server.tsx` | `_island` server: ids, wrapper, slot split + interleave, async → Async/Suspense segment, head forwarding, errors, policy → `_rEffect` + `_rPreload` | T3 |
| `libs/bridge/client.ts` | hydration driver: load island chunk, `hydrate` / `mount`, live-props effect, hydrate-on-change, callback wrapping, unmount, intent replay | T4 |
| `libs/bridge/dom.tsx` | `_island` DOM (client-created islands, client-only, slot `Node[]`) | T4 |
| `libs/bridge/index.ts` | public types (`IslandProps`, `ClientPolicy`, `RivetBridgeFrameworks` registry) + `island()` escape hatch | T3 T5 |
| `libs/bridge/vite.ts` | `bridge()` plugin internals used by `rivet({ bridges })`: ownership filter, facade `resolveId` / `load`, resume module registration, manifest `islands`, dedupe / optimizeDeps, HMR | T5 |
| `libs/bridge/persist.ts` | `persist` parking / claiming over router client hooks | T12 |
| `libs/bridge/tests/**` | node + Chromium suites, fixture apps | every task |
| `libs/bridge-{react,preact,vue,svelte,solid}/{package.json,project.json,tsconfig.json,CLAUDE.md,NOTICE,server.ts,client.ts,vite.ts,types.d.ts,slot.*,tests/**}` | adapters | T6 T8–T11 |
| `libs/runtime/server-markup.ts` (new subpath `./server-markup`), `server-resume.ts` (`_rPreload`), `dom-resume.ts` (`when` display-contents), `jsx-runtime.ts` (types: `ElementType`, `LibraryManagedAttributes`) | runtime hooks | T2 |
| `libs/compiler/vite.ts` | `rivet({ bridges })` option → composes bridge plugins, passes ownership `exclude` | T5 |
| `libs/language-core/{bridge.ts,explain.json}`, `libs/compiler/codes.json` | RV2140–RV2149 | T14 |
| `libs/devtools/**` | island rows, hydrate-now, update log | T13 |
| `libs/create-rivet/**`, `libs/nx/generators/{bridge-setup,island}/**`, `apps/vscode` Doctor | tooling | T15 |
| `apps/island-bench/**` (new), `docs/benchmarks/2026-10-1x-islands.{md,json}` | bench lanes + report | T7 (+ T8–T11 lanes) |
| `vitest.config.ts`, `scripts/zero-cost/*`, `scripts/size-report.mjs`, `scripts/check-tsx-projects.ts`, `scripts/package/*`, `.github/workflows/ci.yml` | registrations, matrix | T1 T16 |
| `apps/docs/content/guides/components/framework-components.md`, `reference/bridge.md`, `learn/…`, `reference/glossary.md`, `_nav.ts`, `apps/docs/examples/bridge-*` | user docs + examples | T17 |
| `libs/mcp/ai/**`, MCP data, generated AI outputs, root `CLAUDE.md`, `docs/CLAUDE.md` | AI / index | T18 |

## Task overview

| Id | Title | Depends |
| --- | --- | --- |
| T1 | Scaffold `libs/bridge` + `libs/bridge-react` + spike: framework runtime bytes, server render CPU per adapter API | — |
| T2 | Runtime hooks: `server-markup`, `_rPreload`, `when("visible")` on `display: contents`, JSX types | T1 |
| T3 | Core server protocol: `_island` server, ids, slots, async / Suspense segments, head, errors | T2 |
| T4 | Core client driver: policies, hydrate / mount / update / unmount, live props, hydrate-on-change, callbacks, DOM `_island` | T3 |
| T5 | Vite integration: ownership, facades, resume registration, manifest + preload, dedupe, HMR, `rivet({ bridges })` | T3 T4 |
| T6 | React adapter (server, client, vite, types) + full suite | T5 |
| T7 | `apps/island-bench`: rivet-bridge-react vs astro-react vs next vs rivet-native + report | T6 |
| T7b | islands-only lean client: no Rivet resume runtime on routes without Rivet resumables, ≤ 3 JS requests cold (T7 losses vs Astro) | T7 |
| T8 | Preact adapter | T6 |
| T9 | Solid adapter + `$$type` delegation collision decision | T6 |
| T10 | Vue adapter (SFC ownership, async render, `setup(app)`) | T6 |
| T11 | Svelte adapter (runes hydration, snippets) | T6 |
| T12 | `persist` across router navigations (`@rivetjs/bridge/persist`) | T6 |
| T13 | Devtools island rows | T6 |
| T14 | Diagnostics RV2140–RV2149 (language-core, TS plugin, vite, codes) | T6 |
| T15 | create-rivet `--bridge`, nx `bridge-setup` + `island` generators, VS Code Doctor | T6 T14 |
| T16 | Zero-cost fixture check, size-report, package build / smoke, CI adapter matrix | T11 T12 |
| T17 | apps/docs guide + reference + examples + glossary (incl. the D-lean fetch-ahead policy, spec §3.12) | T12 T14 |
| T18 | llms / MCP / AI files / CLAUDE.md maps + final gates | T17 |
| T-INTENT-COLD | Follow-up (T4 review L3): `intent` replay of clicks before the runtime boots | T5 |

18 tasks + T7b (inserted after T7, 2026-10-12) + tracked follow-ups (T-INTENT-COLD). T8–T11 can run in parallel after T6 (one adapter each, no shared source files except `vitest.config.ts` / lockfile). T12–T14 can run in parallel with T8–T11.

---

### Task T1: Scaffold + spike

**Files:**
- Create:
  - `libs/bridge/{package.json,project.json,tsconfig.json,CLAUDE.md,index.ts}`:
    - `@rivetjs/bridge`, `0.0.0-experimental`, private, `type: module`, `sideEffects: false`;
    - exports `.` / `./server` / `./dom` / `./client` / `./vite` / `./adapter` / `./persist` (placeholders), `"rivet": { "source": true }`;
    - peer `@rivetjs/runtime` / `@rivetjs/reactivity` / `@rivetjs/compiler`, `publishConfig.directory: ../../dist/libs/bridge`;
  - `libs/bridge-react/{package.json,project.json,tsconfig.json,CLAUDE.md,NOTICE}`: peers per Global Constraints; NOTICE lists React MIT (© Meta Platforms, Inc. and affiliates), from `node_modules/react/LICENSE`;
  - `$S/bridges/spike/` (not committed).
- Modify:
  - root `package.json` devDependencies (`react`, `react-dom` 19.3.0 exact; `@vitejs/plugin-react` exact latest 6.x; `@types/react`, `@types/react-dom`) + lockfile; T1 done: react / react-dom 19.3.0 were already hoisted (apps/dom-bench), lockfile gained only the workspace entries; plugin-react + `@types/*` move to T6 (download permission);
  - `vitest.config.ts`: `node("bridge", ["libs/bridge/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] })`, `browser("bridge-browser", …)`, same for `bridge-react`;
  - `scripts/check-tsx-projects.ts` (if it lists projects).

- [ ] Step 1: Ask permission in chat before `npm install -D react@19.3.0 react-dom@19.3.0 @vitejs/plugin-react@<6.x> @types/react @types/react-dom` (name each, sizes). Install. Check `npm ls react` shows one copy; `apps/dom-bench` resolves the same.
- [ ] Step 2: Bytes spike in `$S/bridges/spike/entries/*.ts`, one entry per import. Bundle with rolldown (minified, production; reuse `scripts/zero-cost/packages-hashes.mjs` config) and report min + br for:
  - `react` + `react-dom/client` `hydrateRoot`;
  - the same + `createRoot`;
  - `preact` `hydrate`;
  - `vue` `createSSRApp`;
  - `svelte` `hydrate` / `mount`;
  - `solid-js/web` `hydrate`.
  - Install the non-React frameworks into `$S/bridges/spike/node_modules` only, after asking permission; not the repo.
- [ ] Step 3: Server CPU spike: render a 50-element and a 500-element component 2,000× per API:
  - React `renderToString` vs `renderToReadableStream` read-to-string;
  - Preact `renderToString`;
  - Vue `renderToString`;
  - Svelte `render`;
  - Solid `renderToString`.
  - Node 26, under the bench lock, 5 alternating rounds; ms / render and allocation (heap delta).
- [ ] Step 4: Write both tables into `libs/bridge/CLAUDE.md` "Upstream costs" and into spec §6.1 (replace the "expected" figures).
- [ ] Step 5: Smoke test `libs/bridge/tests/scaffold.test.ts`: packages resolve; peer ranges equal the plan's table.
- [ ] Gates: vitest `bridge` + `bridge-react` (`--maxWorkers=1`), typecheck both, zero-cost (no deltas).
- [ ] Commit `feat(bridge): scaffold @rivetjs/bridge + bridge-react (peer react 19) + framework cost spike`.

### Task T2: Runtime hooks

**Files:** Modify `libs/runtime/{server-resume.ts,dom-resume.ts,jsx-runtime.ts,package.json,CLAUDE.md}`, `libs/runtime/docs/resume.md`. Create `libs/runtime/server-markup.ts`, `libs/runtime/tests/{server-markup.test.ts,resume-preload-hook.test.ts,resume-visible-contents.browser.test.ts,jsx-foreign-types.test.ts}`.

**Interfaces:**

```ts
// @rivetjs/runtime/server-markup (pay-per-use; never imported by server.ts)
/** Compiler/bridge ABI: framework-rendered HTML written verbatim. Callers guarantee it is escaped markup. */
export function _markup(html: string): ServerValue;
// server-resume.ts
/** Bridge ABI: register a lazily imported chunk (manifest `lazy` key) with the preload planner. */
export function _rPreload(chunkKey: string, strategy: "eager" | "idle" | "visible" | "intent" | "interaction", ids?: readonly number[]): void;
// jsx-runtime.ts (types only)
export namespace JSX {
  export type ElementType = keyof IntrinsicElements | ((props: never) => unknown) | (abstract new (...a: never) => unknown) | RivetForeignObject;
  export type LibraryManagedAttributes<C, P> = C extends ForeignComponent ? IslandPropsOf<C> : P;
}
```

- [ ] Step 1: `_markup`. Pick the brand that `server.ts` writes as raw fragments; prefer an existing record kind (a pre-encoded fragment) over a new branch in the hot writer. Measure ssr-bench: lanes must stay byte-identical (`server.ts` untouched, or no change in emitted code).
- [ ] Step 2: `_rPreload`.
  - Recorder list `preloads`; `planPreload` merges entries as if a symbol of that chunk had that strategy (same precedence / background budget / `VISIBLE_MAX` rules).
  - A key unknown to the manifest → dev warning, prod ignore.
  - Test: state `data-preload` gets `e` / `i` / `v` / `P` for each strategy; background budget counts the closure.
- [ ] Step 3: `dom-resume` `when("visible")`: a target whose `getComputedStyle(target).display === "contents"` observes its element children (cap `OBSERVED` 48). The first intersecting child fires. Chromium test with a `display: contents` wrapper below the fold.
- [ ] Step 4: JSX types. `RivetForeignObject` / `ForeignComponent` / `IslandPropsOf` are declared as augmentable empty interfaces here, filled by `@rivetjs/bridge` (types only). Type test: without bridge types, `<C />` with a React FC still errors as before (no `ElementType` widening leak); with them it typechecks with `client` props.
- [ ] Gates: runtime vitest (node + browser, `--maxWorkers=1`), `runtime:typecheck`, zero-cost (intended deltas: `@rivetjs/runtime/server-resume`, `/dom-resume`, new `/server-markup` line; lanes identical), size-report `--check` (loader unchanged).
- [ ] Commit `feat(runtime): bridge hooks — _markup, _rPreload, visible on display:contents, foreign JSX types` (body: bytes per subpath).

### Task T3: Core server protocol

**Files:** Create `libs/bridge/{adapter.ts,server.tsx,ids.ts,slots.ts}`, `libs/bridge/tests/{server-island.test.tsx,slots.test.ts,server-async.test.tsx,server-errors.test.tsx,fake-adapter.ts}`.

**Interfaces:** spec §3.2 `ServerAdapter`, `IslandContext`, `SlotMark`; plus:

```ts
export interface IslandDef<C = unknown> { id: string; c?: C; a?: ServerAdapter<C>; chunk?: string; head?: (head: IslandHead) => ServerValue }
export function _island(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): ServerValue; // server.tsx (spec §12: loader = module-level function, `_rMod`)
export function splitSlots(html: string, marks: readonly SlotMark[]): { parts: string[]; order: string[] }; // slots.ts
```

- [ ] Step 1: `fake-adapter.ts`: a string-template "framework" (sync + async variants, slot holes, throws on demand). The tests below run against it, framework-free.
- [ ] Step 2: `_island` server.
  - Per-request counter `iN` (stored on the render, reset per request, shared with segments);
  - wrapper `<rivet-island data-ri style="display:contents">`;
  - `client` / `preload` / `persist` / `fallback` stripped from framework props;
  - content props (`_slot` brand / JSX values) → slots;
  - `children` → `default`.
- [ ] Step 3: Slot interleave.
  - `adapter.render` → `splitSlots` → `[_markup(part0), slot0, …]`;
  - a missing or duplicated hole → island error (fallback, else RV2144) naming the island + slot, in every build (T3 review MED-1);
  - Rivet slot content renders in place: test that a resumable button inside a slot gets `data-r` and a handler entry in stream order.
- [ ] Step 4: Async.
  - A Promise result → `Async` boundary;
  - inside a streaming `Suspense` → a segment with its own patch: the test asserts `<template data-a>`, the `data-patch` state holds the island fx, `$rA` order;
  - outside → awaited;
  - abort via `ctx.signal`.
- [ ] Step 5: Head. Adapter-returned `head` parts are forwarded to kit head when rendered in the shell; segment → dev warning, dropped.
- [ ] Step 6: Errors. Throw → nearest `ErrorBoundary`; without one, `fallback` when given; else rethrow with RV2144 text + `appFrames` call site.
- [ ] Step 7: Policy recording. `client` set → `clientEffect(() => hydrateIsland(...), { when })` with captures `load` / root ref / props / options, plus `_rPreload(def.id chunk, strategy)`. No `client` + a live prop read → idle tracker effect (§3.6). Fully static → assert 0 state entries (`state` absent when nothing else is resumable).
- [ ] Tests: per step, node; resume encode via `renderResumable` test helpers.
- [ ] Gates: bridge vitest, typecheck, zero-cost (new `@rivetjs/bridge/server` line only).
- [ ] Commit `feat(bridge): island server protocol — ids, slots in stream, async segments, head, errors, policies`.

### Task T4: Core client driver

**Files:** Create `libs/bridge/{client.ts,dom.tsx,callbacks.ts,triggers.ts}`, `libs/bridge/tests/{client-policies.browser.test.tsx,client-live-props.browser.test.tsx,client-callbacks.browser.test.tsx,client-mount.browser.test.tsx,client-nested.browser.test.tsx,resume-browser.test.ts}` (as built: `triggers.ts` = client-created policy triggers, kept out of the resumed driver chunk; `resume-browser.test.ts` = resumed page end to end through the real driver).

**Interfaces:**

```ts
// client.ts (run with the island's owner: root.tsx wraps the call in runWithOwner)
export function hydrateIsland(load: () => Promise<IslandModule>, root: Element, props: Record<string, unknown>, options: PolicyOptions): void;
export function slotNodes(root: Element): Record<string, Node[] | null>;
/** @internal shared by dom.tsx: mode "mount" + trigger = client-created island */
export function _drive(load, root, props, options, mode: "hydrate" | "mount", given: Record<string, Node[] | null>, clear?: () => void, trigger?: Trigger): void;
export interface IslandModule { default: unknown; adapter: ClientAdapter }
// dom.tsx
export function _island(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): DOMValue;
```

- [ ] Step 1: Driver.
  - Load the island chunk → `adapter.hydrate(root, C, snapshot(props), slotNodes(root), { id })` → handle;
  - owner cleanup → `unmount`;
  - chunk load failure → static + `console.error` once (dev: island id).
- [ ] Step 2: Live props.
  - `effect` over `snapshot(props)` skipping the first run;
  - one `update` per Rivet batch;
  - test: React-free fake adapter counts renders: 3 signal writes in one batch → 1 update.
- [ ] Step 3: Hydrate-on-change for static islands with live props (old values hydrate, then update). Test: no mismatch; chunk requested only after the first change (network log).
- [ ] Step 4: Callbacks.
  - Wrap function props once per island with reactivity `batch` + error reporting;
  - test: a callback writes a Rivet signal → Rivet DOM updated synchronously after the call returns;
  - measure first-click frames vs `_dispatch` (record in commit).
- [ ] Step 5: `intent` policy.
  - Island-local pointerover dwell (60 ms, same as loader) / focusin / touchstart → load + hydrate;
  - a pointerdown / click that arrived before hydration is re-dispatched once after it;
  - test with the fake adapter's click counter.
- [ ] Step 6: `only` + DOM `_island`.
  - Server writes `fallback`;
  - the client mounts and replaces the fallback;
  - client-created islands (`Show` branch) mount when the policy fires;
  - slots rendered into a fragment and passed as `Node[]`.
- [ ] Step 7: Nesting. Outer fake island update keeps the inner island's root + handle (identity check); the inner hydrates before the outer.
- [ ] Gates: bridge browser vitest, typecheck, zero-cost (new `/client`, `/dom` lines).
- [ ] Commit `feat(bridge): client driver — policies, live props, hydrate-on-change, callbacks, intent replay, client mount, nesting`.

### Task T-INTENT-COLD: intent replay before the runtime boots (follow-up, T4 review L3)

Gap: the `intent` recorder (`libs/bridge/intent.ts`) attaches when the island's hydration effect starts (runtime boot + driver chunk). A pointerdown / click on an `intent` island before that is lost (the loader's cold event snapshot records only elements carrying Rivet handlers, `data-r` delegation).

- [x] Route (as built, DERIVED-GAPS 04 2026-10-28: no marker needed — the derived island hole's boundary listens to `*`, the loader holds the cold press and replays it after the adopt run; `client.ts` `watch()` records presses synchronously, moved from `intent.ts`; 0 loader / server bytes). Planned: the server marks an `intent` island root with a delegated `data-r` marker (no handler symbol), so the existing loader replay chain snapshots cold events on it and hands them to the driver once hydrated. Target: 0 loader bytes (marker reuses the existing delegation lookup).
- [x] Test (`libs/bridge/tests/derived-browser.test.ts` "intent", chromium + webkit): resumed page, click before boot → one replay on the island's target after hydration; default action once.
- [x] User-facing limits section updated (framework-components.md).

### Task T5: Vite integration

**Files:** Create `libs/bridge/{vite.ts,ownership.ts,facade.ts}`, `libs/bridge/tests/{ownership.test.ts,facade.test.ts,vite-build.test.ts,vite-hmr.test.ts}` + fixture app `libs/bridge/tests/fixtures/app/**`. Modify `libs/compiler/vite.ts` (`bridges` option), `libs/compiler/CLAUDE.md`, `libs/compiler/tests/vite-bridges.test.ts`.

**As built:** also `libs/bridge/hot.ts` (dev-only track / swap / park / claim) and `libs/bridge/tests/app.ts` (fixture copy helper); `BridgeEntry` gains optional `dedupe` / `optimize` / `configure`; facade ids carry no `?env=` (one facade text for both environments, environment parts via `virtual:rivet-bridge/core` / `virtual:rivet-island-def:` / `virtual:rivet-island-client:`); export lists parsed from the source (`parseAst`; rolldown `this.load` returns no code in `buildStart`); manifest gains `islands: { key → chunk }` (instead of island keys in `lazy`); Step 6 ruling: a Rivet page edit keeps islands mounted (park / claim), not a remount. Details: spec §12 "Vite integration (T5)".

**Interfaces:**

```ts
export interface BridgeEntry { name: string; owns(id: string, source?: string): boolean; specifiers: (string | RegExp)[]; plugins(): Plugin[]; server: string; client: string; types?: string }
// libs/compiler/vite.ts
rivet({ bridges?: BridgeEntry[] })
```

- [ ] Step 1: Ownership (`ownership.ts`): suffix rules, pragma (`foreignJsxPragma` reuse), `include` / `exclude`, npm specifiers. RV2145 when a file matches Rivet + an adapter. Unit matrix.
- [ ] Step 2: `rivet({ bridges })`.
  - Inserts each bridge's framework plugins before `vite-plugin-rivet`, sharing the filter;
  - Rivet's compile filter gets the union as `exclude`;
  - `bridges: []` / absent → **no plugin added, no config change**: test that plugin list + resolved config equal HEAD.
- [ ] Step 3: Facades.
  - `resolveId` (Rivet importer + foreign target → `\0rivet-island:<id>?env=`);
  - `load` emits TSX (export list via `this.load` → `moduleInfo.exports`, fallback es-module-lexer; `export *` resolved; type-only skipped; non-components re-exported);
  - the facade id joins the resumable module set (`resume.modules` hook); its client variant's `load` arrow is a dynamic import of `\0rivet-island-client:<id>` (= component + adapter client).
- [ ] Step 4: Manifest. Island chunk keys appear in `.vite/rivet-resume.json` `lazy` + `sizes` / `deps`, so `_rPreload` resolves them. `resume.lazyOwned` is not affected.
- [ ] Step 5: Dedupe + deps.
  - `resolve.dedupe` per adapter;
  - `optimizeDeps.include` for the client runtime entries (dev);
  - SSR keeps frameworks external.
  - Build test: fixture with two React islands → one `react-dom` chunk.
- [ ] Step 6: HMR (dev server test via Vite `createServer`).
  - A foreign component edit → framework HMR, Rivet page state kept;
  - an export list change → importer invalidated;
  - a Rivet page edit → island remount (dev).
- [ ] Step 7: Per-page bytes report line at build end (`[rivet:bridge] <route>: react N KB br`), from manifest closures.
- [ ] Step 8: RV2146 warning for non-component exports used in browser symbols.
- [ ] Gates: bridge + compiler vitest, compiler typecheck, `compiler:parity`, zero-cost (compiler `vite.ts` hash may change → intended delta; lanes identical), size-report.
- [ ] Commit `feat(bridge): vite — ownership rules, island facades, resume registration, preload manifest, dedupe, HMR`.

### Task T6: React adapter

**Files:** Create `libs/bridge-react/{server.ts,client.ts,vite.ts,slot.tsx,types.d.ts,index.ts}`, `libs/bridge-react/tests/{ssr-parity.test.tsx,react-policies.browser.test.tsx,react-live.browser.test.tsx,react-slots.browser.test.tsx,react-errors.browser.test.tsx,react-suspense.test.tsx}` + fixtures (`*.react.tsx`).

**As built:** `slot.ts` / `types.ts` (not `slot.tsx` / `types.d.ts`: no React JSX in the package, `.ts` types export through `./types`), plus `tree.ts` (shared element tree); tests `ssr.test.ts` (node: string / stream / hoistables / errors / abort / `_island` end to end), `vite-build.test.ts` (T5 review F3: one React copy), `types.test.ts`, `react-hydrate.browser.test.tsx` (live props, callbacks, slots, `useId`, `onRecoverableError`, nesting, `stopPropagation`), `react-policies.browser.test.tsx` (every policy, chunk-load counts); fixtures `tests/fixtures/*.ts` with `createElement` (the test loader Rivet-compiles `.tsx`). `react()` adds the `rivet:react:jsx-source` pragma plugin (tsconfig `jsxImportSource` beats Vite's global oxc JSX options). T6 review: root suspensions without a boundary go through the stream; the T5 runtime-use code is RV2148 (RV2147 stays the `only` hint, T14); RV2149 = island hydration recovery (`islandRecovered`, devtools `error.island`); `islands.exclude`; classes count only with `extends`. Details: spec §12 "React adapter (T6)".

- [ ] Step 1: Server.
  - `render`: `renderToString` fast path when the probe shows no suspension, else `renderToReadableStream(el, { identifierPrefix: id + "-", nonce, signal })` read to completion;
  - React 19 hoistables → head parts (no regex strip);
  - `onError` → reject.
  - The T1 numbers decide the default (`server.stream: "auto"`).
- [ ] Step 2: Client.
  - `hydrateRoot(root, el, { identifierPrefix, onRecoverableError })` inside `startTransition`;
  - `mount` = `createRoot`;
  - `update` = `root.render` (sync when called inside a user event, else transition);
  - `unmount` = `root.unmount()`.
- [ ] Step 3: Slot component: `<rivet-slot dangerouslySetInnerHTML={{ __html: "" }} suppressHydrationWarning />` memoized; client-mount variant appends `Node[]` in `useLayoutEffect`. Named slots camelCased; `children` default.
- [ ] Step 4: `vite.ts` `react(options)`: defaults `*.react.{tsx,jsx}` + pragma `react`; composes `@vitejs/plugin-react` with the filter (`plugin: false` support).
- [ ] Step 5: `types.d.ts` augments `RivetBridgeFrameworks` (`ComponentType<P>`, `ExoticComponent`, class components) → `IslandProps<C>`. Type tests: `client` typo errors, prop type errors surface at the Rivet call site.
- [ ] Tests:
  - SSR parity (island inner HTML = React's own output for the same props, ids aside);
  - every policy in Chromium with network assertions;
  - live props (React render counter);
  - callbacks → Rivet signals;
  - slot with a resumable Rivet button before + after hydration;
  - nested React › React;
  - Suspense segment island;
  - `onRecoverableError` path;
  - `useId` uniqueness across 3 islands;
  - React `stopPropagation` vs a Rivet ancestor handler (documented semantics).
- [ ] Gates: bridge-react node + browser, typecheck, zero-cost (new lines), prettier.
- [ ] Commit `feat(bridge-react): React 19 islands — SSR (string / stream), hydrateRoot, live props, slots, types`.

### Task T7: `apps/island-bench`

**Files:** Create `apps/island-bench/{project.json,tsconfig.json,CLAUDE.md,README.md,run.ts,report.ts,serve-rivet.ts,rivet-build.ts,components/*.react.tsx,lanes/{rivet-bridge-react,astro-react,next,rivet-native}/**}` (no app `package.json`, see Done), `docs/benchmarks/2026-10-1x-islands.{md,json}`. Modify `docs/CLAUDE.md` (benchmarks entry).

- [x] Step 1: Shared page spec. Header + 1000-row Rivet list (Astro / Next: same markup from the same data) + React counter `load` + chart `visible` below the fold + date-like picker `idle` + one static React island. Same React component sources in every lane (symlinked folder).
- [x] Step 2: Lanes.
  - Astro 7.3.8 + `@astrojs/react` 7.0.1;
  - Next (version pinned in `apps/editorial-bench/lanes/next` reuse);
  - `rivet-native`: islands rewritten in Rivet.
  - Ask permission before installs.
- [x] Step 3: Server metrics with the ssr-bench loadgen + `fair-report.ts` verdict helpers (in-process or Docker; document which): CPU / page, TTFB p50, complete p50, peak RSS, c1 + c10.
- [x] Step 4: Browser metrics with the resume-bench harness (4× CPU, Fast 3G + unthrottled):
  - bytes + JS requests before first input;
  - first-input-to-paint per island;
  - hydration CPU;
  - CLS.
- [x] Step 5: Report: WIN / TIE / LOSE per metric + what Rivet would need for each loss; json next to md.
- [x] Gates: bench runs under the bench lock; RSS ≤ 3 GB (measure the Next build).
- Done 2026-10-12: own in-process loadgen + Playwright/CDP harness (not the ssr-bench / resume-bench harnesses: fixed lanes), no app `package.json` (Rivet lanes resolve from the root, Astro lane own install, Next = symlink to the editorial-bench lane install), components imported by relative path; no lane compresses (Astro standalone cannot), browser bytes raw + gzip estimate; `firstInputSync` not measured. Report `docs/benchmarks/2026-10-12-islands.{md,json}`.
- [x] Commit `bench(islands): apps/island-bench — Rivet+React islands vs Astro+React vs Next vs Rivet native`.

### Task T7b: islands-only lean client

Inserted 2026-10-12 (coordinator ruling after T7): T7 lost to astro-react on bytes before input (gzip est. 1.30×) and JS requests before input (16 vs 5): an islands-only page loads the Rivet resume entry + reactivity + DOM runtime (≈ 53 KB raw) because the island hydration is a `clientEffect` (`root.tsx`), plus ~10 small facade / island / resume chunks.

**Files (as landed):** Create `libs/bridge/{lean.ts,boot.ts,build-boot.ts,boot.min.ts (generated)}`, tests `libs/bridge/tests/{lean.test.ts,lean-boot.browser.test.ts,fixtures/lean-island.ts,fixtures/lean-mismatch.ts}`. Modify `libs/bridge/{server.tsx,vite.ts (root-relative island keys),CLAUDE.md}`, `libs/bridge/tests/{harness.ts,vite-build.test.ts}`, `libs/runtime/{server-resume.ts (`_rLean`, tail hook),CLAUDE.md}`, `apps/island-bench/{run.ts,report.ts,serve-rivet.ts,README.md,CLAUDE.md}` (baseline lane `rivet-bridge-react-full`), spec §3.12 / §8.1, `scripts/zero-cost/{packages,runtime}.txt` (own lines), `docs/benchmarks/2026-10-12-islands.{md,json,notes.md}`.

Coordinator rulings 2026-10-12: approach (B) hybrid (render-time decision, exact per render); bytes target TIE (≤ 1.05× astro-react: both ship the same React), JS requests WIN (≤ 3); lean and full tails from one build manifest; zero cost without bridges; (A) parked below.

- [x] (a) Lean tail on islands-only renders (spec §3.12): island records + inline boot + modulepreloads, no resume loader / entry / reactivity / DOM runtime. Deviation: no build-time manifest flag — the decision is exact per render (B), the same manifest serves both tails; mixed routes unchanged (full tail, test).
- [x] (b) Cold path ≤ 3 JS requests without ChunkGroup grouping: inline boot + island chunk (component + adapter) + shared vendor. `load` / `only` chunks + deps modulepreloaded; `idle` / `visible` chunk + deps modulepreloaded at idle (the planner's `i` / `P`; fix round 1 L3). Ruling in spec §3.12.
- [x] (c) Zero cost: client bundles 0 B; `server-resume` +91 B min (server only, one optional read per render); `@rivetjs/bridge/server` 4,267 → 9,089 B min (server only, after fix round 1). The `server-resume` line in `runtime.txt` also absorbed ≈ +20.1 KB of earlier unrecorded drift (85,074 → 105,236 B; other lanes' commits), not T7b bytes.
- [x] (d) Tests: `lean.test.ts` (exact tail, policies, the same route with JSON vs non-JSON props → both tails, deterministic, full tail for live / callback / slot / intent / non-JSON / mixed / no manifest, nonce, dev log lines, `boot.min.ts` current), `lean-boot.browser.test.ts` (every policy through the boot, idle prefetch of `visible`, mismatch → mount, chunk failure, `only`), `vite-build.test.ts` (built output: lean tail, preloads = `load` chunk + deps ≤ 3, no runtime / loader URL, mixed page keeps the full tail).
- [x] (e) island-bench re-run with the T7-fixed baseline lane (`rivet-bridge-react-full`: same build, full driver), NODE_ENV=production server phase re-measured (loaded host, 30-min lock wait expired): bytes TIE vs astro-react (78.6 vs 80.8 KB gzip est.), JS requests WIN 4 vs 5 (3 at load + idle `visible` prefetch; 16 before T7b), 0 LOSE vs the full driver, CPU / page 2.26× vs astro-react. `docs/benchmarks/2026-10-12-islands.md`.
- [x] Fix round 1 (review `$S/bridges/task-T7b-review.md`): M1 getter props reading no signal are static (`_trackReads`, test `computed getter props that read no signal are static`); L3 idle closures; L6 built-output byte equality (both tails, mixed unchanged); L7 dev log; docs M2 / L4 / Info 8.
- [x] Follow-up "lean client + router navigation" (review M2) → landed as D-lean in the DEMO lane (2026-10-12, spec §3.12 "D-lean"): router region + `intent` nav listeners go into a deferred, non-booting state after the lean boot; fetch-ahead only with router document prefetch (`preload.ahead`).
- Later optimisation (A), not scheduled: a compiler (Rust) static proof per route ("no Rivet resumable reachable") to skip the render-time collector on proven routes; only if the collector shows up in server CPU / page.
- [x] Commit `perf(bridge): T7b islands-only lean client — no resume runtime, ≤ 3 JS requests on islands-only routes`.

### Task T8: Preact adapter

**Files:** `libs/bridge-preact/**` (same layout as T6), lanes `apps/island-bench/lanes/{rivet-bridge-preact,astro-preact}` + `components/*.preact.tsx`; shared: `libs/bridge/ownership.ts` `jsxSource` (moved from bridge-react), `vitest.config.ts`, `scripts/zero-cost/packages-hashes.mjs`.

- [x] Step 1: Installed (user approval): `preact@11.0.1` + `preact-render-to-string@6.8.0` (workspace devDependencies); no `@preact/preset-vite` (optional peer only). Floor: preact 10.29.8 in a `$S` scratch install (ids, SSR, hydrate ok) → peer `>=10.29.0 <12`.
- [x] Step 2: Ids via the `useId` mask: private `__m` field on the island vnode (no public option hook exposes it; documented in CLAUDE.md + spec §12) → `P<id>-<n>`. Server `renderToString`, `renderToStringAsync` on suspension; client `hydrate` / `render`; `update` = `render(h(C, p), root)`; `unmount` = `render(null, root)`.
- [x] Step 3: `@preact/signals` in props: out of scope v1 (CLAUDE.md).
- [x] Step 4: Ownership `*.preact.{tsx,jsx}` + pragma `preact`; build test with Preact + React islands in one app (one copy each, chunks not shared); types test with both bridges.
- [x] Tests: `preact.test.ts`, `ssr.test.ts`, `vite-build.test.ts`, `types.test.ts`, `preact-hydrate` / `preact-policies` browser suites. Bench lanes, first run (loaded host, cross-version Preact 11 only, superseded by fix round 1's same-version p10 headline 16 WIN / 13 TIE / 1 LOSE): vs astro-preact 16 WIN / 14 TIE / 0 LOSE (CPU / page 1.93×, bytes before input 17.7 vs 20.4 KB gzip est., JS requests 4 vs 6). `docs/benchmarks/2026-10-12-islands.md` "Preact pair".
- [x] Folded in (T7b re-review): N1 boot modulepreload links carry the boot script's nonce; N2 lean-decision tests (computed / store reads, Date / function getters, `untrack` caveat documented).
- [x] Commit `feat(bridge-preact): Preact islands`.
- [x] Fix round 1 (review `$S/bridges/task-T8-review.md`):
  - F1: one `useId` mask per client island (browser test `useId after a live-prop update`).
  - F2: `FunctionComponent` / `FC` / compat `memo` / `forwardRef` / `lazy` types.
  - F3: same-version lane `rivet-bridge-preact-p10` (vs astro-preact 16 WIN / 13 TIE / 1 LOSE; the LOSE is a bimodal counter-paint sample split on a loaded host, see notes) + Preact build rows.
  - F4: server mask probe → RV2150.
  - F6: `render(null)` before the mount-over.
  - F7: tests — Suspense error, inline `<title>`, hydrate throw, React ↔ Preact nesting, boot nonce in the browser.
  - F9 / F10: peers `preact-render-to-string >=6.7.0`, docs floors, lock peer, Preact 11 upstream bytes, no-island-head rule.
  - Docs: F5 mismatch, F8 preset untested, F11 Slot not memoised.

### Task T9: Solid adapter + delegation collision

**Files:** `libs/bridge-solid/**`, lanes `rivet-bridge-solid` / `astro-solid`; possibly `libs/runtime/dom-v2.ts` (key rename) + krausest numbers.

- [x] Step 1: Server.
  - `renderToString` / `renderToStringAsync` (with Suspense) with `renderId: id`;
  - `head()` returns `generateHydrationScript({ nonce })` once per page;
  - slots via `ssr(holeHtml)`.
- [x] Step 2: Client.
  - `hydrate(() => createComponent(C, store), root, { renderId })`;
  - `update` = `setStore(reconcile(props))`;
  - `mount` = `render`.
- [ ] Step 3: Collision. Test a Solid island (delegated `onClick`) inside a Rivet page with delegated handlers: does Rivet's dom-v2 `delegate` run Solid's `$$click`?
  - If yes, A/B: (a) Rivet key → `"$r" + type` (krausest + dom-bench under the bench lock); (b) Solid islands compiled with `delegateEvents: false`.
  - Pick by measurement. (a) touches `libs/runtime/dom-v2.ts` and the compiler emits keys? Check `_on`; if the compiler emits key strings, (a) needs a Rust patch → patch queue.
- [x] Step 4: Ownership `*.solid.{tsx,jsx}` + pragma `solid-js`; `vite-plugin-solid` `ssr: true` on the server environment only.
- [ ] Tests: T6 list; collision regression test.
- [ ] Commit `feat(bridge-solid): Solid 1.9 islands (+ delegation key decision)`.

Implementation evidence and exact maintained-suite results: `2026-10-30-remaining-framework-islands.md`. Adapter delivery is implemented; competitor lanes and unrun benchmark/floor-matrix work remain open.

### Task T10: Vue adapter

**Files:** `libs/bridge-vue/**`, lanes `rivet-bridge-vue` / `astro-vue`.

- [x] Step 1: Server.
  - `createSSRApp({ render: () => h(C, props, slots) })`, `app.config.idPrefix = id`;
  - `setup(app)` option (Pinia, i18n);
  - `renderToString` (Promise → async island);
  - teleports to `head` → head parts.
- [x] Step 2: Client.
  - `createSSRApp` with a `shallowReactive(props)` root → `mount(root)` hydrates;
  - `update` assigns keys;
  - `mount` = `createApp`;
  - `unmount` = `app.unmount()`.
- [x] Step 3: Slots = render functions returning a static `rivet-slot` vnode (`innerHTML: ""`) on both sides; named slots keep their names.
- [x] Step 4: `.vue` ownership via `@vitejs/plugin-vue`; SFC scoped CSS goes through the Vite CSS pipeline, linked per island module. Check Rivet's CSS link collection includes island chunk CSS (test: no FOUC on static islands).
- [ ] Tests: T6 list + async component in a `Suspense` segment + Pinia store per island.
- [ ] Commit `feat(bridge-vue): Vue 3.5 islands`.

Implementation evidence and exact maintained-suite results: `2026-10-30-remaining-framework-islands.md`. Adapter delivery is implemented; competitor lanes and unrun benchmark/floor-matrix work remain open.

### Task T11: Svelte adapter

**Files:** `libs/bridge-svelte/**`, lanes `rivet-bridge-svelte` / `astro-svelte`.

- [x] Step 1: Server: `render(C, { props: { ...props, children, $$slots, ...namedSnippets }, idPrefix: id })` → `{ head, body }` (async when thenable); snippets from ONE shared `holes.ts` used on both sides.
- [x] Step 2: Client.
  - `hydrate(C, { target: root, props: $state(props) })` (`.svelte.ts` module for runes);
  - `update` assigns / deletes keys;
  - `mount` / `unmount` from `svelte`;
  - `hydration_mismatch` → `mount` fallback with slot nodes preserved.
- [x] Step 3: `.svelte` / `.svelte.ts` ownership via `@sveltejs/vite-plugin-svelte` (`compilerOptions.css: "external"` so CSS goes through Vite).
- [ ] Tests:
  - T6 list;
  - byte-identical server body vs hydrated DOM for slot holes;
  - forced mismatch recovery keeps a resumable Rivet slot button working;
  - nested React › Svelte › Rivet (spec §3.4 test).
- [ ] Commit `feat(bridge-svelte): Svelte 5 islands`.

Implementation evidence and exact maintained-suite results: `2026-10-30-remaining-framework-islands.md`. Adapter delivery is implemented; competitor lanes and unrun benchmark/floor-matrix work remain open.

### Task T12: `persist` across navigations

**Files:** Create `libs/bridge/persist.ts`, `libs/bridge/tests/persist.browser.test.tsx` + router fixture. Modify `libs/router/client/CLAUDE.md` (only if a hook is added), `libs/bridge/CLAUDE.md`.

- [ ] Step 1: Use existing router client hooks (`onNavigate`, leave / `_landed`); add a minimal `_beforeDispose(page)` hook in `@rivetjs/router/client` only if needed (pay-per-use, zero-cost line for router).
- [ ] Step 2: Park on page dispose (root + handle in a detached fragment, owner kept alive); claim by `persist` key + island id on the next render (swap placeholder, `update(newProps)` or keep with `persist-props`); unclaimed → unmount after commit; View Transition name kept.
- [ ] Tests: React counter state survives `navigate` A → B → A; a layout island survives without `persist`; unclaimed unmounts (React unmount spy); full reload resets.
- [ ] Gates: bridge + router browser tests; zero-cost (router unchanged or listed).
- [ ] Commit `feat(bridge): persist islands across client navigations`.

### Task T13: Devtools

**Files:** `libs/devtools/**` (island node type, panel fields, hydrate-now, updates log), `libs/bridge/client.ts` dev hook (`#dev` condition only), tests in `libs/devtools/tests/`.

- [ ] Step 1: Dev-only `__rivetBridgeDev` registration (state transitions, hydrate ms, chunk bytes from manifest, prop snapshot).
- [ ] Step 2: Tree node `⟨React⟩ Counter` with lucide `component` icon via `@rivetjs/kit/icon`; "Hydrate now"; update log rows with changed keys.
- [ ] Gates: devtools tests; zero-cost dev-leak scan: `none`.
- [ ] Commit `feat(devtools): framework island rows`.

### Task T14: Diagnostics RV2140–RV2149

**Files:** Create `libs/language-core/bridge.ts`, tests `libs/language-core/tests/bridge.test.ts`. Modify `libs/compiler/codes.json` (reserve RV2140–2159, add 2140–2147; RV2148 / RV2149 / RV2150 are registered already by T5 / T6 / T8), `libs/language-core/{explain.json,index.ts,fixes.ts,CLAUDE.md}`, `docs/guides/editor.md` code table, `libs/typescript-plugin` (if registration is explicit).

- [ ] Step 1: Island site detection: JSX tag whose import resolves to a foreign-owned module (ownership rules read from `.rivet/editor.json`: the bridge plugin writes `bridges: [{ name, include, exclude }]` there; extend `updateEditorManifest`).
- [ ] Step 2: Checks per spec §7:
  - RV2140 Signal-as-value, with quick fix `x={s}` → `x={s()}`;
  - RV2141 non-serializable prop, via `serializationProblem`, only when `client` is set or a prop is live;
  - RV2142 scoped slot;
  - RV2143 `_markup` import;
  - RV2147 `only` without `fallback` (hint).
  - RV2144 / RV2145 / RV2146 are runtime / vite: register codes + explain text.
- [ ] Step 3: `codes.test.ts` passes (every emitted code registered); `rivet-check` CLI output fixture.
- [ ] Gates: language-core + compiler codes tests, typescript-plugin build.
- [ ] Commit `feat(language-core): island diagnostics RV2140–RV2149`.

### Task T15: Tooling

**Files:** `libs/create-rivet/**` (`--bridge` flag + prompt, overlay that edits `vite.config.ts` + adds deps + example island), `libs/nx/generators/{bridge-setup,island}/**` + `generators.json` + tests, `apps/vscode` Doctor checks, CLAUDE.md files of each.

- [ ] Step 1: create-rivet. `--bridge react,svelte` (multi); prompt only in interactive mode. Templates stay bridge-free (the overlay applies on top). e2e `node scripts/package/create-e2e.ts --bridge react`: install, build, the index page shows the island, hydration works (Playwright).
- [ ] Step 2: nx.
  - `bridge-setup --framework <fw>` (deps, vite config, tsconfig `types`);
  - `island <Name> --framework <fw> --project <p>` → `<Name>.<fw>.tsx` / `.vue` / `.svelte` + usage snippet + test.
  - Generator tests (tree snapshots).
- [ ] Step 3: Doctor: adapter installed, framework plugin present (or `plugin: false` + plugin found), peers in range, ownership overlaps (RV2145 preview).
- [ ] Gates: create-rivet + nx tests, `scripts/package/create-e2e.ts` (heavy.sh), vscode build.
- [ ] Commit `feat(tooling): create-rivet --bridge, nx bridge-setup + island generators, Doctor checks`.

### Task T16: Zero-cost, size, package, CI matrix

**Files:** `scripts/zero-cost/{packages-hashes.mjs,packages.txt,conditions*}`, new fixture check `scripts/zero-cost/bridge-fixture.mjs` (+ `check.sh` call), `scripts/size-report.mjs`, `scripts/package/{build.ts,smoke.ts}`, `.github/workflows/ci.yml` (adapter matrix job), `scripts/CLAUDE.md`.

- [ ] Step 1: Package hash lines for every `@rivetjs/bridge*` subpath; condition parity entries (`/server` vs `/dom`).
- [ ] Step 2: Fixture check. Router app with `/islands` (React island) + `/plain` (Rivet only), built twice: with the bridge, and without it (`/islands` removed). `/plain` HTML + state + `data-preload` + its JS closure must be byte-identical. Prints `bridge fixture: identical`.
- [ ] Step 3: size-report rows: bridge driver, each adapter client, each framework runtime (informative).
- [ ] Step 4: Package build + smoke for all six packages (peer ranges preserved in generated manifests).
- [ ] Step 5: CI matrix: per adapter at range floor + latest (`npm i --no-save <fw>@<v>` in the job), runs that adapter's suites.
- [ ] Gates: full zero-cost, size-report, smoke, `scripts` tests.
- [ ] Commit `chore(bridge): zero-cost fixture check, size rows, packaging, CI adapter matrix`.

### Task T17: User docs + examples

**Files:**
- Create:
  - `apps/docs/content/guides/components/framework-components.md` (spec §8.1 outline);
  - `apps/docs/content/reference/bridge.md`;
  - `apps/docs/content/learn/bring-your-react-components.md`;
  - `apps/docs/examples/{bridge-react-counter,bridge-svelte-chart,bridge-mixed,bridge-persist}/**`.
- Modify:
  - `apps/docs/content/_nav.ts`;
  - `reference/glossary.md` (Island: chunk group vs framework island);
  - `guides/performance/chunks.md` (cross-link);
  - `guides/performance/preloading.md` (island policies in the strategy table);
  - `reference/config.md` (`rivet({ bridges })`);
  - `apps/docs/CLAUDE.md`.

- Status 2026-10-19 (DOCS-SWEEP): `guides/components/framework-components.md` landed (React + Preact: install, ownership, policies, live props, callbacks, slots, nesting, errors, islands-only pages, limits) + nav, glossary, `coming-from-other-frameworks`, `reference/config.md` (`rivet({ bridges })`), roadmap. Still open: `reference/bridge.md`, the `learn/` page, examples, `preloading.md` policy rows.
- [ ] Step 1: Pages. Every claim has a number from T1 / T7 (bytes table per framework, bench verdicts). Policy table with Astro / Qwik equivalents. Limits section (incl. the T-INTENT-COLD gap while it is open: an `intent` island replays only events after the runtime booted). "Islands-only pages" section (T7b, spec §3.12): when a page boots without the Rivet resume runtime, what keeps the full driver (the dev log line), bytes / requests from the T7b bench. "Wide islands, not leaf nodes".
- [ ] Step 2: Examples run in docs-kit frames (`framePreload` budget 0 as today) and use lucide icons only.
- [ ] Gates:
  - `node libs/docs-kit/cli.ts check-content docs --strict`;
  - `check-snippets docs`;
  - `NX_DAEMON=false npx nx run docs:build` (heavy.sh, RSS ≤ 3 GB);
  - docs-kit `check-examples` bytes before input.
- [ ] Commit `docs(bridge): use React / Vue / Svelte / Solid / Preact components — guide, reference, examples`.

### Task T18: AI outputs, maps, final gates

**Files:** `libs/mcp/ai/**` (agent rule: framework islands), `libs/mcp/build-data.ts` inputs + generated data, generated `llms.txt` / `llms-full.txt` / per-page `.md`, skills (`node libs/mcp/ai/sync.ts`), root `CLAUDE.md` repo map rows (`libs/bridge`, `libs/bridge-*`, `apps/island-bench`), `docs/CLAUDE.md`, every touched CLAUDE.md.

- [ ] Step 1: Regenerate (never hand-edit):
  - `node libs/docs-kit/cli.ts llms docs`;
  - `node libs/mcp/build-data.ts`;
  - `node libs/mcp/ai/sync.ts`.
- [ ] Step 2: Grep docs + md for stale statements ("functions are not supported as island props", old chunk-group "island" wording, "no raw HTML" claims that now need the `_markup` internal note).
- [ ] Step 3: Full gates:
  - `npm run typecheck`;
  - all nx `test` targets (heavy.sh, `--maxWorkers=1` per vitest);
  - zero-cost;
  - size-report `--check`;
  - `compiler:parity`;
  - format check;
  - llms / MCP / AI `--check`;
  - cdk-docs + ui-docs builds untouched (`git diff --stat` shows none).
- [ ] Commit `docs(bridge): AI files, MCP data, repo maps for framework bridges`.
