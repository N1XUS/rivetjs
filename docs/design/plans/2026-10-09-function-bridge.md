# Function Bridge (Phases 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every value a resumed component captures (functions anywhere, `let`, hoisted declarations, `.bind`, mutual recursion, narrow paths, stores, contexts, data classes, built-ins, resource holders) resumes with plain-JS semantics or fails with a named compile / render error.

**Architecture:** Phase 1 (Reference + Context bridge) extends the existing `{f, a}` recipe entries with module references (`_rMod`), escape-analysed `_rFn`, hoisted registrations with late captures, boxed `let` cells, `.bind` and group entries, narrow member / store captures, and per-site context frames (registry in reactivity, auto ids from the compiler, `createResume({ contexts })` dropped). Phase 2 (Reconstruct) adds built-in formats, prototype-restored data classes (`_rClass`, `{cls}` two-phase decode), `serialize` / `revive` holders and `reconstruct(() => …)`. Compiler work ships as patch files the root applies and builds; runtime work is plain TDD.

**Tech Stack:** TypeScript (Node 26, vitest, Playwright Chromium via the corpus harness), Rust/oxc compiler → wasm (root-built via Docker), `@rivetjs/reactivity`, `@rivetjs/runtime` resume stack.

**Spec:** [`docs/design/specs/2026-10-09-function-bridge-design.md`](../specs/2026-10-09-function-bridge-design.md) (§10 = user rulings Q1–Q6). Corpus: [`libs/runtime/tests/function-bridge-corpus-browser.test.ts`](../../../libs/runtime/tests/function-bridge-corpus-browser.test.ts) + [`libs/runtime/tests/resume/bridge-corpus.ts`](../../../libs/runtime/tests/resume/bridge-corpus.ts).

## Global Constraints

- Non-negotiables (spec §2): revived functions keep the **sync signature** (same arity, sync return, `this` as at the call site, never a Promise / QRL); **no extra fetch** for anything the compiler sees (every new entry kind is walked by `reachEntry` / `reachableSymbols`, so its symbols are in `needs`); **content-stable ids + fail-safe mismatch**; **compile-time named errors** (capture path + source location + quick fix); **zero cost** (non-resume modules byte-identical, pages using no bridged shape keep identical state + HTML).
- Perf budget (spec §8): state bytes ≤ +2% brotli on ui showcases (dashboard / mail / chat / settings) and ssr-bench `/resume` (0 / 1000 rows); encode / resume SSR CPU ≤ +2% in-process (interleaved A/B, ≥ 5 rounds, 1-min load < 4); first-click paint unchanged (resume-bench `click` / `keyClick` / `filter` within noise); `/dom-resume` growth reported, Phase 1 target ≤ +600 B min; plain render + DOM benches byte-identical (zero-cost gate).
- User rulings (spec §10): Q1 per-symbol skew checks only, no boot-time manifest check · Q2 `let` cells encode at their **first** encode, dev warning on a later server write · Q3 `reconstruct` lives in `@rivetjs/runtime`, separate from `clientOnly` · Q4 drop `createResume({ contexts })`; app singletons use `reconstruct` (breaking) · Q5 recipe consts whose value holds only References / data encode by value (no double side effects) · Q6 dev capture names ship in the dev manifest.
- Rust rule (root `CLAUDE.md`, user rule 2026-10-06): only the root / lead edits `libs/compiler/rust/**` and runs `libs/compiler/rust/build.sh`. A compiler task = write `$S/patches/BRIDGE-<task>.patch` (unified diff vs HEAD, `git apply --check` clean) + `$S/patches/BRIDGE-<task>.md` (what / why, expected emission before → after for 2–3 corpus cases, verify = the `bridge:` cases it flips, oracle cases expected to change), then SendMessage `main`: `PATCH READY $S/patches/BRIDGE-<task>.patch`. The root applies, builds the wasm once per batch, runs compiler tests + oracle + zero-cost + `typescript-plugin:build`, commits the Rust, replies. The implementer then (wasm installed in the tree) runs the task's gates and commits the TS side (tests, corpus flips, docs).
- Prefer new Rust in `libs/compiler/rust/src/compile/*` modules over growing `compile.rs` (`resume_cells.rs`, `resume_classes.rs`, `resume_refs.rs` named below).
- Lanes: `S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad`; read `$S/perf/IMPL-COMMON.md` (binding): heavy commands only via `bash $S/heavy.sh …`, vitest `--maxWorkers=1`, ≤ 3 GB tree RSS, Edit-in-place only on shared files (re-read right before editing), temp-index commits of own hunks, never touch user WIP files.
- `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH`; zsh; `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; run from the repo root with absolute paths.
- Each task flips the named corpus cases from `bridge: test.fails` to passing (edit the case: `today: "pass"`, delete `note`), and must not turn any green corpus case red (both projects).
- Docs follow code (user rule 2026-10-08): every task updates the nearest `CLAUDE.md` + docs describing what it changed; T21 / T29 sweep the rest.
- Experimental framework: breaking changes allowed (no aliases / shims); every in-repo consumer is updated in the same change.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Consumed from the parallel lane (C1 + C2 + runtime fail-safe; NOT in this plan)

- **C1** (compiler + runtime): the `new X` capture check allows Map / Set / Date / URL / URLSearchParams / RegExp / typed arrays / ArrayBuffer / DataView / Error, and `resume-format` encodes them (entry keys `t` RegExp, `U` URLSearchParams, `b` binary, `E` Error). Flips `map-data`, `set-data`, `date`, `url`, `regexp`, `typed-array`. (Former plan task T22 "built-in formats" is therefore dropped: done by C1.)
- **C2** (compiler): content-stable ids. Closure symbols are `<module>#<Component>$<h>` (`h` = shortest unique ≥ 3 base-36 digit prefix (C1C2-SLIM), 64-bit FNV-1a over normalized closure source + sorted capture names / kinds + symbol kind + component name); identical twins get `_<k>` (ordinal among equal hashes, source order; `_` not `.` because the name is also the chunk export). Compiler tests in this plan match ids with `\$[0-9a-z]+(?:_\d+)?`. Hashes skip the D2 suffixes `ref` / `ctx` / `class` (compiler `RESERVED_SUFFIXES` extends such a prefix by a digit), so they never collide.
- Corpus at hand-off: 52 cases, 31 green (new case `skew-changed`). After T1: 56 cases.
- **Runtime fail-safe**: `dom-resume` `symbol()` treats a missing export (`module[local] === undefined` / `__rivet(id) === undefined`) as skew and calls the loader's `fail` (`$r.f`): cancelable `rivet:resume-error` with `detail.skew = id`, then the guarded reload (once per URL per 10 s). Flips `skew-renumbered`.
- Every task below assumes C1 + C2 + fail-safe are committed. If they are not yet, compiler tests pin ids with the same regex (it also matches `$<n>`).

### Plan-level decisions (spec gaps found while planning; lead confirms or overrides before the task starts)

- D1 `_rRef` is taken (ref cells / `ref()` objects, `server-resume.ts:1832`): the Reference registration is **`_rMod(value, id)`**.
- D2 (superseded for refs by T3 fix round 1: `<unit>#<name>$<h5>$ref`, unit = resolved module id, thunk stamps `__rivetR_mod((() => x), id[, 1])` — `libs/compiler/CLAUDE.md` "Module references") Symbol ids for module references / classes: **`<module>#<local>$ref`** and **`<module>#<Class>$class`** (the symbol module exports `Local = id after '#'`; a bare `<module>#inc` would export `inc` and collide with the re-exported source binding; `import:pkg:name` is not an identifier). Local binding names are unique per module, so imports use the same form.
- D3 `{f}` "without `a`" stays `{f: id, a: []}` server-side (wire compact `{f:[sym]}` = same bytes): `reachEntry` / `reachableSymbols` / `full()` require `a`.
- D4 State key `x` is taken (intent-excluded chunks) and entry key `x` (context id): frames go in state **`cf`** (side map, the loader never reads it). Entry keys `t` / `U` / `b` / `E` are taken by C1's built-ins; new keys here: `gm`, `cls`, `rv` (+ custom kinds `cell` / `bind` / `store` / `ext`).
- D5 Group members cannot use entry key `n` (special numbers): **`gm`**.
- D-priv (correction 2026-10-11, spec §Data classes): `Object.create(Cls.prototype)` has no private brand, so `Cls[RESTORE](o, privates)` throws on `#fields`. T23/T24 drop the private accessor pair: classes with `#private` fields get RV2102-style compile error naming the field with fix `static [revive]`; `data-class-private` moves to T25 (explicit `static [revive]`). `{cls, a: [fieldsRef]}` only — no `privateRef`. Native bind (T-bind): `_rBound(f, t, args)` evaluates `f` before `t`/args and skips the stamp when `f.bind !== Function.prototype.bind`.
- D6 Class entries cannot be `{k:"cls", c, d}` (`c` = computed, `d` = date, and custom kinds decode under BUSY, which forbids the self-cycle class-field arrows need): **`{cls: SymbolRef, a: [fieldsRef, privateRef?], rv?: 1}`**, a dedicated two-phase decoder branch.
- D7 **RV2101 is already registered** (language-service "Captured value not serializable"; codes are never reused): spec RV2101–2105 become **RV2102** resource holder · **RV2103** package function in a container · **RV2104** dynamic store path (warning, language service) · **RV2105** Symbol / WeakMap / Promise · **RV2106** `this` outside an object literal method.
- D8 `.ts` modules are never resume-compiled (cdk `sidebar/state.ts`, `autocomplete/contexts.ts`, …), so compiler auto ids (C10) cannot reach them: the id registry moves into reactivity **`createContext(value, { id })`** (every id'd token is resumable); `.ts` contexts keep explicit ids; `resumableContext` is deleted.
- D9 Router singletons (`Navigation` → module `navigation` signal, `SearchParams` → per-request server signal / browser `searchParams` module signal) live in `.ts` package modules where `reconstruct` cannot compile: internal ABI **`_rExtern(value, id)`** (server, WeakMap value → id) + **`_externValue(id, value)`** (browser registry, `resume-format`), called by the router's generated server / resume entries only. Public singletons stay `reconstruct`.
- D10 `@rivetjs/runtime` has no root entry: `reconstruct` is exported from **`@rivetjs/runtime/dom`** with its server twin in **`@rivetjs/runtime/server`** (compiler `TARGET_HELPERS`), and a resume-mode `reconstruct(f)` call is a Computed site emitted as `_rComputed(id, f, caps, { equals: false })`. Spec §5 has no compiler item for it: **C14** (T27).
- D11 Frames for `{f}` entries: Rivet `useContext` reads the *calling* owner, so a revived function called from a handler / binding already sees that site's frame. Frames are recorded for handlers, bindings, effects, client events (and computeds keep RESUME-CTX `v`); recipe-const initializers are not framed (RESUME-CTX measured +3–7% for them; Q5 removes most).
- D12 Bindings' "frame appended last" collides with `BindingEntry`'s variadic rest: frames live in the `cf` side map keyed by wire index.
- D13 `let-after-jsx` is fixed by cells (C6, T8), not thunks: thunks (C5, T6) are needed only for hoisted declaration registrations (TDZ). Cell locals keep their name (`const clicks = _rCell(0)`, reads `clicks.v`), not `clicks$`.
- D14 Corpus `resource-class` and `library-object` expect `["0", …]` passes, contradicting spec §4 (explicit `reconstruct` / named error): their correct outcome becomes a named error (`bridge` field, T1), plus new passing cases `resource-reconstruct`, `resource-revive`, `library-object-reconstruct`.
- D15 Spec §9 risk-5 "same own-key set" dev check is vacuous with `Object.assign` restore; dropped in favour of the EventTarget / Node / DOM denylist.

### Gate commands (named; each task lists which it runs)

```bash
S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad
cd /Users/denisseverin/Projects/claude-test/rivet
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false
# G-CORPUS — all corpus tests pass (flipped cases now run as plain `test`); table printed:
BRIDGE_CORPUS_LOG=1 bash $S/heavy.sh npx vitest run --project runtime --project runtime-dev libs/runtime/tests/function-bridge-corpus-browser.test.ts --maxWorkers=1 --disableConsoleIntercept
# G-RT — runtime suites + typecheck:
bash $S/heavy.sh npx vitest run --project runtime --project runtime-dev --maxWorkers=1
bash $S/heavy.sh npx nx run runtime:typecheck --output-style=static --skip-nx-cache
# G-RX — reactivity:
bash $S/heavy.sh npx vitest run --project reactivity --project reactivity-dev --maxWorkers=1
bash $S/heavy.sh npx nx run reactivity:typecheck --output-style=static --skip-nx-cache
# G-CMP — after the root installed the wasm:
bash $S/heavy.sh npx vitest run --project compiler --maxWorkers=1
bash $S/heavy.sh node libs/compiler/oracle/check.ts          # 227/227 (or N/N after the root's intended re-records)
bash $S/heavy.sh npx nx run typescript-plugin:build --output-style=static
# G-UI — resumed component renders:
bash $S/heavy.sh npx vitest run --project cdk-components --maxWorkers=1
bash $S/heavy.sh npx vitest run --project ui-components --maxWorkers=1
# G-ZC — report: dev leaks: none / condition parity: ok / N/N corpus cases match; hash deltas of own packages only (never --update):
bash $S/heavy.sh sh scripts/zero-cost/check.sh
# G-SIZE — report /dom-resume + /server-resume deltas:
bash $S/heavy.sh npm run size-report -- --check
# G-BYTES — state bytes per showcase (compare with $S/perf/BRIDGE-P1/baseline.txt, ≤ +2% br):
(cd $S/perf/BRIDGE-P0 && RESUME=1 bash $S/heavy.sh node --import ./register-ab.mjs bytes.tsx \
  /Users/denisseverin/Projects/claude-test/rivet/apps/ui-docs/examples/showcase-dashboard/src/routes/index.tsx \
  /Users/denisseverin/Projects/claude-test/rivet/apps/ui-docs/examples/showcase-mail/src/routes/index.tsx \
  /Users/denisseverin/Projects/claude-test/rivet/apps/ui-docs/examples/showcase-chat/src/routes/index.tsx \
  /Users/denisseverin/Projects/claude-test/rivet/apps/ui-docs/examples/showcase-settings/src/routes/index.tsx)
# G-FMT — own clean files only:
npx prettier --write <files you own that were prettier-clean at HEAD>
```

Commit recipe (every task; `$LANE` = task id):

```bash
export GIT_INDEX_FILE=$S/idx-$LANE-$$; git read-tree HEAD; git add -- <own files>
# a file with other lanes' hunks: blob = HEAD + own hunks; git hash-object -w <tmp>; git update-index --cacheinfo 100644,<blob>,<path>
git commit -m "<message>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
unset GIT_INDEX_FILE; git show --name-only --format= HEAD | xargs git reset -q --
```

## File Structure

| File | Responsibility | Tasks |
| --- | --- | --- |
| `libs/runtime/tests/resume/bridge-corpus.ts` | corpus cases (+ `bridge` named-error outcome, 4 new cases) | T1, every flip |
| `libs/runtime/tests/function-bridge-corpus-browser.test.ts` | corpus runner (`bridge` assertion, dev capture names in its manifest) | T1, T19 |
| `libs/runtime/tests/resume/bridge-encode.ts` (new) | node round-trip helper: encode captures through `_rEffect`, decode with `createDecoder` | T2 |
| `libs/runtime/tests/bridge-*.test.ts` (new) | node unit tests per entry kind | T2 T5 T7 T9 T12 T15 T17 T18 T19 T23 T25 T26 |
| `libs/runtime/server-resume.ts` | `_rMod`, thunk captures, `_rCell`, `_rBound`, `_rFn` member index, `_rStorePaths`, frames (`cf`), `_rExtern`, Q5, dev capture names, class encode | Phase 1–2 |
| `libs/runtime/resume-format.ts` | entry types + decoder: `cell`, `bind`, `gm`, `store`, `ext`, `cls`; `SiteFrames`; `_externValue`; `serialize` / `revive` / `registerClass` | Phase 1–2 |
| `libs/runtime/dom-resume.ts` | decoder hooks (`bind`, `store`, `ext`, `cls`), frame owners, `createResume()` without contexts | T9 T12 T15 T17 T23 |
| `libs/runtime/dom.ts`, `libs/runtime/server.ts` | `reconstruct` (+ server twin) | T26 |
| `libs/reactivity/index.ts` | `createContext` id registry, `_contextById`, `_placeholderContext`; `store.ts` `_storePaths` | T12 T14 |
| `libs/compiler/abi.ts`, `libs/runtime/package.json` | `RUNTIME_ABI` / `rivet.abi` 7 → 8 | T2 |
| `libs/compiler/vite.ts` | dev manifest `captures`; default entry `createResume()` | T17 T19 |
| `libs/router/build/codegen.ts` | `_rExtern` / `_externValue` instead of `createResume({ contexts })` | T17 |
| `libs/compiler/rust/src/compile/resume_refs.rs` (new, root) | C3 `_rMod` epilogue + ref symbols | T3 |
| `libs/compiler/rust/src/resume.rs` (root) | C4 escape, C5 hoist, C7 narrow, C8 groups, C10 ctx ids, C11 store paths, C13 diagnostics, C14 reconstruct | T4 T6 T10 T11 T13 T16 T20 T27 |
| `libs/compiler/rust/src/compile/resume_cells.rs` (new, root) | C6 `let` cells | T8 |
| `libs/compiler/rust/src/compile/resume_classes.rs` (new, root) | C12 `_rClass` + private accessors + field arrows + RV2102 | T24 |
| `libs/compiler/tests/resume-bridge-*.test.ts` (new) | emission tests per compiler task | compiler tasks |
| `libs/compiler/codes.json`, `libs/language-core/{explain.json,fixes.ts,serializable.ts}` | RV2102–RV2106 + quick fixes | T20 T28 |
| `libs/cdk/**`, `libs/ui/**`, tests | `resumableContext(...)` removal codemod | T14 |
| docs / AI sources | rule deletions, regenerated outputs | T21 T29 (+ per task) |

## Task overview and lanes

| Id | Title | Kind | Lane · group | Flips (bridge cases) |
| --- | --- | --- | --- | --- |
| T1 | Corpus: named-error outcomes + 4 new cases + baseline | runtime-test | G0 (first, alone) | — |
| T2 | Reference format: `_rMod`, ABI 8, round-trip helper | runtime | R1 · G1 | (with T3) |
| T3 | C3 `_rMod` epilogue + ref symbols | compiler | CA · G1 | obj-module-fn, library-fn-in-object |
| T4 | C4 escape analysis into captured holders | compiler | CB · G1 | assigned-fn, signal-fn |
| T5 | Thunk (late) captures in `_rFn` | runtime | R1 · G1 | (with T6) |
| T6 | C5 hoisted declaration registrations | compiler | CA · G1 (after T3) | hoisted-declaration |
| T7 | `let` cells runtime (`_rCell`, Q2 warning) | runtime | R1 · G1 | (with T8) |
| T8 | C6 boxed `let` cells | compiler | CA · G1 (after T6) | let-shared-cell, let-after-jsx |
| T9 | `.bind` + group member entries | runtime | R1 · G1 | (with T10) |
| T10 | C8 group symbols + C9 `.bind` rewrite | compiler | CA · G1 (after T8) | mutual-recursion, bound-fn |
| T11 | C7 narrow member captures, every site kind | compiler | CB · G1 (after T4) | narrow-object |
| T12 | Store path narrowing runtime | runtime + reactivity | R3 · G1 | (with T13) |
| T13 | C11 store literal paths | compiler | CB · G1 (after T11) | narrow-store |
| T14 | Context id registry in reactivity, delete `resumableContext` | reactivity + runtime + codemod | R2 · G1 | — |
| T15 | Site frames (`cf`) + frame owners | runtime | R2 · G1 (after T14) | context-in-handler, context-in-binding |
| T16 | C10 auto context ids | compiler | CB · G1 (after T13) | context-row (needs T14 + T15) |
| T17 | Drop `createResume({ contexts })`, `_rExtern`, router | runtime + router | R2 · G1 (after T15) | — |
| T18 | Q5 recipe consts by value | runtime | R1 · G1 (after T4 + T9) | recipe-side-effect |
| T19 | Dev capture names (Q6) + index-free prod messages | runtime + compiler TS | R3 · G1 (after T12) | — |
| T20 | C13a diagnostics RV2103–RV2106 + language-core | compiler + TS | CB · G1 (after T16) | — |
| T21 | Phase 1 close: perf gates + docs-follow-code | docs + measure | lead · after G1 | — |
| T23 | Class registry runtime (`{cls}` two-phase) | runtime | R1 · G2 | (with T24) |
| T24 | C12 `_rClass`, private accessors, field arrows, RV2102 | compiler | CA · G2 | class-store, class-arrow-field, data-class, data-class-private, data-class-nested, resource-class (named error) |
| T25 | `serialize` / `revive` / `registerClass` | runtime | R1 · G2 (after T23) | resource-revive (needs T24) |
| T26 | `reconstruct` runtime + library-object hint | runtime | R2 · G2 | library-object (named error) |
| T27 | C14 `reconstruct` sites | compiler | CB · G2 | resource-reconstruct, library-object-reconstruct |
| T28 | RV2102 / RV2105 quick fixes + explain entries | TS | R3 · G2 (after T24) | — |
| T29 | Phase 2 close: perf gates + docs-follow-code | docs + measure | lead · after G2 | — |
| T30 | Phase 3a: `serializeAndRevive` test helper + skew reload e2e + corpus `today` flips | runtime + tests + docs | R3 · after T29 | skew-renumbered / skew-changed (reload e2e), data-class-private (named error), data-class-private-revive |
| T31 | Phase 3b: resume fuzz over the ui / cdk story apps | testing + CI | lead · after T30 | fuzz findings → pins |

Status (2026-10-12): T1–T13, T18, T19, T21, T23–T31 done; T31 closed the Function Bridge run. T14–T17 (context chain) and T20 (RV2103–RV2106) are **parked**: T14 blocked on UI-IDENTITY (touches 169 ui/cdk files), T15–T17 / T20 follow it. Corpus pins they flip: spec §8.4.

Parallelism: G1 runs lanes R1 (T2 → T5 → T7 → T9 → T18), R2 (T14 → T15 → T17), R3 (T12 → T19), CA (T3 → T6 → T8 → T10), CB (T4 → T11 → T13 → T16 → T20) at once (≤ 6 lanes, CPU gate). A compiler task's patch can be written before its runtime twin lands; its corpus flip waits for both. The root batches CA + CB patches in queue order (re-check `git apply --check` against the new HEAD; a writer rebases its own patch on conflict). G2 starts after T21.

---

### Task T1: Corpus named-error outcomes, new cases, baseline

**Files:**
- Modify: `libs/runtime/tests/resume/bridge-corpus.ts` (interface `BridgeCase`; cases `resource-class`, `library-object`; 4 new cases)
- Modify: `libs/runtime/tests/function-bridge-corpus-browser.test.ts` (bridge assertion, lines 147–154)
- Create: `$S/perf/BRIDGE-P1/baseline.txt`

**Interfaces:**
- Produces: `BridgeCase.bridge?: { status: "compile" | "render" | "client"; message: string }` — the correct outcome is that named error; the `bridge:` test is plain `test` once `today === bridge.status && note === bridge.message`.
- Produces: case ids `recipe-side-effect`, `resource-reconstruct`, `resource-revive`, `library-object-reconstruct` (flipped by T18, T27, T25, T27).

- [ ] **Step 1: Add the `bridge` field to `BridgeCase`** (after `note?: string;`):

```ts
  /**
   * The correct outcome is a named error, not `expect` (spec §4: resource holders / library objects need `reconstruct`
   * or `static [revive]`). The bridge test asserts this status + message (regex, case-insensitive) instead of `expect`.
   */
  bridge?: { status: "compile" | "render" | "client"; message: string };
```

- [ ] **Step 2: Runner — replace the `bridge:` test block** (the `(c.today === "pass" ? test : test.fails)(…)` statement):

```ts
  const done = c.today === "pass" || (c.bridge !== undefined && c.today === c.bridge.status && c.note === c.bridge.message);
  (done ? test : test.fails)(`bridge: ${c.group} / ${c.id} — ${c.title}`, () => {
    const o = outcomes.get(c.id)!;
    if (c.bridge) {
      assert.equal(o.status, c.bridge.status, o.message);
      assert.match(o.message, new RegExp(c.bridge.message, "i"));
      return;
    }
    assert.equal(o.status, "pass", o.message);
    assert.deepEqual(o.seen, c.expect);
  });
```

- [ ] **Step 3: Named outcomes for the two cases** — add to `resource-class`:

```ts
    bridge: { status: "compile", message: "Cannot resume `conn\\.live`: Conn instance holds a resource" },
```

and to `library-object`:

```ts
    bridge: { status: "render", message: "function is not serializable.*reconstruct\\(" },
```

- [ ] **Step 4: Append the four cases** (before the `// ── deploy skew` block):

```ts
  // ── Function Bridge additions (plan T1) ────────────────────────────────────────────────────────────────────────
  {
    id: "recipe-side-effect",
    group: "closure",
    title: "recipe const holding only References: its initializer must not run again in the browser (Q5)",
    source: page(
      "const fns = track([() => n.set(n() + 1)]);",
      "fns[0]!()",
      "function track<T>(x: T): T { const g = globalThis as { __inits?: number }; g.__inits = (g.__inits ?? 0) + 1; return x; }",
    ),
    read: `document.querySelector(".out").textContent + ":" + (window.__inits ?? 0)`,
    expect: ["0:0", "1:0"],
    today: "wrong",
    note: "1:1",
  },
  {
    id: "resource-reconstruct",
    group: "class",
    title: "resource holder built by reconstruct(() => new Conn(url)): lazy, in the browser",
    source: page(
      'const conn = reconstruct(() => new Conn("wss://x"));',
      "n.set(conn().send() ? 1 : -1)",
      'import { reconstruct } from "@rivetjs/runtime/dom";\nclass Conn { url: string; live: boolean; constructor(url: string) { this.url = url; this.live = typeof window !== "undefined"; } send() { return this.live; } }',
    ),
    expect: ["0", "1"],
    today: "render",
  },
  {
    id: "resource-revive",
    group: "class",
    title: "resource holder with [serialize]() + static [revive](data): rebuilt from its data",
    source: page(
      'const conn = new Conn("wss://x");',
      'n.set(conn.send() && conn.url === "wss://x" ? 1 : -1)',
      'import { revive, serialize } from "@rivetjs/runtime/resume-format";\nclass Conn { url: string; live: boolean; constructor(url: string) { this.url = url; this.live = typeof window !== "undefined"; } send() { return this.live; } [serialize]() { return { url: this.url }; } static [revive](data: { url: string }) { return new Conn(data.url); } }',
    ),
    expect: ["0", "1"],
    today: "compile",
    note: "class instances are not serializable",
  },
  {
    id: "library-object-reconstruct",
    group: "library",
    title: "library object built by reconstruct(() => createChart(4))",
    source: page("const chart = reconstruct(() => createChart(4));", "n.set(chart().size())", 'import { reconstruct } from "@rivetjs/runtime/dom";\nimport { createChart } from "fake-chart";'),
    libs: { "fake-chart": "export function createChart(size) { return { size: () => size, browser: typeof window !== 'undefined' }; }" },
    expect: ["0", "4"],
    today: "render",
  },
```

- [ ] **Step 5: Run G-CORPUS and pin observed `today`.** Expected: every `today:` test passes except possibly the 4 new ones; for each failing new `today:` test copy the printed `[bridge] … <status> <message>` into `today` (+ a stable message fragment as `note`). `resource-class` / `library-object` `today:` stay as before (their `bridge:` stays `test.fails` until T24 / T26). Re-run until all pass (56 cases × 2 projects).

- [ ] **Step 6: Record the byte baseline** (after C2 landed): run G-BYTES, save output to `$S/perf/BRIDGE-P1/baseline.txt` (later tasks compare against it, not §8.1, because C2's hash suffix is already in it).

- [ ] **Step 7: Commit** `test(runtime): bridge corpus named-error outcomes + reconstruct / revive / Q5 cases` (files: the two corpus files).

---

### Task T2: Reference format — `_rMod`, ABI 8, round-trip helper

**Files:**
- Create: `libs/runtime/tests/resume/bridge-encode.ts`, `libs/runtime/tests/bridge-reference.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`_rFn` :1845, `special` non-function branch :2297), `libs/runtime/package.json` (`rivet.abi` 8), `libs/compiler/abi.ts` (`RUNTIME_ABI = 8` + comment), `libs/runtime/CLAUDE.md`, `libs/runtime/docs/resume.md`

**Interfaces:**
- Produces: `export function _rMod<T>(value: T, id: string): T` (`@rivetjs/runtime/server-resume`): process-wide, module-load stamp; the value encodes `{f: id, a: []}` wherever reached (function or object import); a later `_rFn` never replaces it.
- Produces: `roundTrip(make, symbols?, hooks?)` test helper (below), used by T5 T7 T9 T12 T15 T17 T18 T23 T25.

- [ ] **Step 1: Write the helper** `libs/runtime/tests/resume/bridge-encode.ts`:

```ts
// Function Bridge unit-test helper: encode `make()`'s values as the captures of one client effect (a resumable render,
// no element needed), then decode them with the browser decoder. `symbols`: id → factory (what the symbol chunk exports).
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { DecoderHooks, ResumeState } from "@rivetjs/runtime/resume-format";
import { readable } from "./wire.ts";

export const FX = "t.tsx#T$fx";
const fakeSignal = (): DecoderHooks["signal"] => () => {
  let value: unknown;
  const s = (() => value) as (() => unknown) & { set(v: unknown): void; update(f: (v: unknown) => unknown): void };
  s.set = (v) => void (value = v);
  s.update = (f) => void (value = f(value));
  return s as never;
};
export async function roundTrip(
  make: () => unknown[],
  symbols: Record<string, (...captures: never[]) => unknown> = {},
  hooks: DecoderHooks = {},
): Promise<{ state: ResumeState; values: unknown[]; html: string }> {
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries([FX, ...Object.keys(symbols)].map((id) => [id, "/c.js"])) };
  const html = (await resumableToString(() => {
    _rEffect(FX, make());
    return "x" as never;
  }, { manifest })) as string;
  const state = readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as ResumeState;
  const decoder = createDecoder(state.t, {
    signal: fakeSignal(),
    fn: (id, captures) => (symbols[id as string] as (...c: unknown[]) => unknown)(...captures),
    ...hooks,
  });
  return { state, html, values: (state.fx[0]![1] as number[]).map(decoder.get) };
}
```

- [ ] **Step 2: Write the failing test** `libs/runtime/tests/bridge-reference.test.ts`:

```ts
// Function Bridge T2: module references (`_rMod`) encode as capture-free `{f}` entries anywhere.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { _rFn, _rMod } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

function inc(s: { (): number; set(v: number): void }) {
  s.set(s() + 1);
}
const config = { mode: "dark" };
_rMod(inc, "m.tsx#inc$ref");
_rMod(config, "m.tsx#config$ref");

test("a module reference encodes once, without captures, in objects, arrays, Maps and signals", async () => {
  const { state, values } = await roundTrip(() => [{ inc }, [inc], new Map([["k", inc]]), signal(inc)], {
    "m.tsx#inc$ref": () => "browser-inc",
  });
  const refs = state.t.filter((e) => e !== null && typeof e === "object" && (e as { f?: unknown }).f === "m.tsx#inc$ref");
  assert.equal(refs.length, 1);
  assert.deepEqual((refs[0] as { a: number[] }).a, []);
  const [obj, arr, map, sig] = values as [{ inc: unknown }, unknown[], Map<string, unknown>, () => unknown];
  assert.equal(obj.inc, "browser-inc");
  assert.equal(arr[0], "browser-inc");
  assert.equal(map.get("k"), "browser-inc");
  assert.equal(sig(), "browser-inc");
});

test("an imported object stamped with _rMod is a reference (browser module identity), not a copy", async () => {
  const { values } = await roundTrip(() => [{ config }], { "m.tsx#config$ref": () => "browser-config" });
  assert.equal((values[0] as { config: unknown }).config, "browser-config");
});

test("a per-render _rFn on a module reference keeps the module id", async () => {
  const { state } = await roundTrip(() => [_rFn("m.tsx#Page$a1", inc, [])], { "m.tsx#inc$ref": () => 0 });
  assert.ok(state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#inc$ref"));
  assert.ok(!state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#Page$a1"));
});
```

- [ ] **Step 3: Run it — expect FAIL** `bash $S/heavy.sh npx vitest run --project runtime libs/runtime/tests/bridge-reference.test.ts --maxWorkers=1` → `_rMod is not a function` (export missing).

- [ ] **Step 4: Implement.** In `server-resume.ts` after `const fns = Recipe;`:

```ts
// Function Bridge (Reference, plan T2): a module-level function / import of a resume module, stamped once at module load by
// the compiler epilogue (`_rMod(inc, "src/a.tsx#inc$ref")`). Encodes `{f: id, a: []}` (wire `{f:[sym]}`) wherever a render
// reaches it — objects, arrays, Maps, signals; the browser symbol (`() => (inc)`) returns the module's own binding.
// `render: MODULE` marks it for every render; a per-render `_rFn` on the same value never replaces it.
const MODULE: object = Object.freeze({});
export function _rMod<T>(value: T, id: string): T {
  if (Object(value) === value) fns.set(value as object, { id, captures: EMPTY_CAPTURES, render: MODULE });
  return value;
}
```

In `_rFn` replace the stamping line with:

```ts
  if (recorder && Object(fn) === fn) {
    const known = fns.get(fn as object)?.render;
    if (known !== recorder.options && known !== MODULE) fns.set(fn as object, { id, captures, render: recorder.options });
  }
```

In `special`, non-function branch, right after `if (meta === undefined) return undefined;`:

```ts
      if (meta.render === MODULE) return { f: meta.id, a: [] };
```

Bump `libs/runtime/package.json` `"abi": 8` and `libs/compiler/abi.ts` `export const RUNTIME_ABI = 8;` with comment `// 8: Function Bridge (_rMod, thunk captures, _rCell, _rBound, _rFn member, _rStorePaths, _rClass).`

- [ ] **Step 5: Run the test — expect PASS.** Then G-RT, G-ZC (runtime `server-resume` hash delta expected; report it), G-BYTES (expect identical: nothing emits `_rMod` yet).

- [ ] **Step 6: Docs.** `libs/runtime/CLAUDE.md`: add under resume gotchas `_rMod(value, id)` (module references, `{f, a: []}`, never replaced by `_rFn`, ids `<module>#<local>$ref`); `libs/runtime/docs/resume.md` `{f}` entry: `a` may be empty (module reference). `libs/compiler/CLAUDE.md` `abi.ts` line: `8: Function Bridge`.

- [ ] **Step 7: Commit** `feat(runtime): _rMod module references + resume ABI 8 (Function Bridge T2)`.

---

### Task T3: C3 — `_rMod` epilogue + reference symbols (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-refs.test.ts`
- Patch (root applies): `libs/compiler/rust/src/compile/resume_refs.rs` (new), `libs/compiler/rust/src/resume.rs` (value-position scan in `scan` / `escaping` :698 / `module_function`), `libs/compiler/rust/src/compile.rs` (module epilogue + `resume_names` entry `mod` → `_rMod`)
- Patch files: `$S/patches/BRIDGE-T3.patch`, `$S/patches/BRIDGE-T3.md`

**Interfaces:**
- Consumes: T2 `_rMod(value, id)`; C2 ids.
- Produces: server code `__rivetR_mod(<local>, "<module>#<local>$ref");` once per referenced module function / import, after the module's last statement; DOM main module unchanged; symbol `{ id: "<module>#<local>$ref", kind: "ref", component: <first referencing component>, captures: [], source: "export const <local>$ref = () => (<local>);\n" }` (imports: package specifiers re-imported in `imports`, relative / local ones in `locals`).
- Rule: a reference = an identifier resolving to a module-level function declaration / `const` function, or a static import binding (also `ns.member` static member chains of a namespace / default import → id `<module>#<ns>$<member>$ref`), used in a **value position** (not a callee, not a JSX tag, not `typeof`) inside a component of a resume module. Direct props / `const f = g` aliases (CORE-GAPS (d)) keep working (their `_rFn` meets T2's "never replaced").

Expected emission (corpus):

```js
// obj-module-fn — before (server)
function inc(s) { s.set(s() + 1); }
export function Page() { const n = signal(0); const api = { inc }; … __rivetR_on("click", "src/obj-module-fn.tsx#Page$h0", [api, n]) … }
// after: same, plus at module end
__rivetR_mod(inc, "src/obj-module-fn.tsx#inc$ref");
// symbol (dom): export const inc$ref = () => (inc);   locals: ["inc"]

// library-fn-in-object — after
__rivetR_mod(double, "src/library-fn-in-object.tsx#double$ref");
// symbol: import { double } from "fake-util"; export const double$ref = () => (double);
```

- [ ] **Step 1: Write the failing compiler test** `libs/compiler/tests/resume-bridge-refs.test.ts`:

```ts
// Function Bridge T3 (C3): module functions / imports used as values in a resume module are module references.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

type Sym = { id: string; kind: string; component: string; captures: string[]; source: string; imports: { local: string; from: string }[] };
const out = (source: string, target: "server" | "dom") => {
  const r = compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; diagnostics: unknown[]; symbols: Sym[] };
  assert.deepEqual(r.diagnostics, []);
  return r;
};
const source = `import { signal } from "@rivetjs/reactivity";
import { double } from "fake-util";
function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }
export function Page() {
  const n = signal(0);
  const api = { inc, double };
  return <button onClick={() => api.inc(n)}>{n()}</button>;
}`;

test("value uses of module functions and imports register module references at module end", () => {
  const server = out(source, "server").code;
  assert.match(server, /__rivetR_mod\(inc, "src\/a\.tsx#inc\$ref"\);\s*__rivetR_mod\(double, "src\/a\.tsx#double\$ref"\);\s*$/);
  assert.equal(server.split("__rivetR_mod(inc,").length, 2);
  assert.doesNotMatch(out(source, "dom").code, /_rMod|__rivetR_mod/);
});

test("reference symbols return the module binding; package imports are re-imported", () => {
  const symbols = out(source, "dom").symbols;
  const inc = symbols.find((s) => s.id === "src/a.tsx#inc$ref")!;
  assert.equal(inc.kind, "ref");
  assert.equal(inc.component, "Page");
  assert.equal(inc.source, "export const inc$ref = () => (inc);\n");
  const double = symbols.find((s) => s.id === "src/a.tsx#double$ref")!;
  assert.deepEqual(double.imports.map((i) => [i.local, i.from]), [["double", "fake-util"]]);
});

test("callee-only uses register nothing", () => {
  const callOnly = `import { signal } from "@rivetjs/reactivity";
function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }
export function Page() { const n = signal(0); return <button onClick={() => inc(n)}>{n()}</button>; }`;
  assert.doesNotMatch(out(callOnly, "server").code, /__rivetR_mod/);
});
```

- [ ] **Step 2: Run — expect FAIL** `bash $S/heavy.sh npx vitest run --project compiler libs/compiler/tests/resume-bridge-refs.test.ts --maxWorkers=1` (no `__rivetR_mod` emitted).

- [ ] **Step 3: Write the patch.** In `resume.rs` collect `module_refs: Vec<(String /*local*/, NodeId /*decl*/, String /*component*/)>` during `scan`: for `IdentifierReference` whose decl is module-scope (`module_function(decl)` or `import_source(tree, decl).is_some()`) and whose parent is not a `CallExpression` callee / `JSXOpeningElement` name / `UnaryExpression(typeof)` / `ImportSpecifier`, inside a component. Dedupe by decl (first component wins). Push a `Symbol { name: format!("{local}$ref"), id: format!("{module}#{local}$ref"), kind: "ref", component, captures: vec![], scope: vec![local], imports/locals as for Fn sites, source: format!("export const {local}$ref = () => ({local});\n") }` (put the builder in new `compile/resume_refs.rs` as `pub fn ref_symbol(tree, module, local, decl, component) -> Symbol`). In `compile.rs` server target: after the last module statement emit `self.r("mod", vec![Expr::ident(local), Expr::Str(id)])` + `;` per ref (register `("mod", "_rMod")` in the resume helper name table next to `fn`). DOM target: nothing. Write `$S/patches/BRIDGE-T3.patch` + `.md` (emission above, verify = flip `obj-module-fn`, `library-fn-in-object`; oracle: resume snapshots of modules with value-used module functions change — list case indexes from `node libs/compiler/oracle/check.ts` run by the root).

- [ ] **Step 4: Hand off** — SendMessage `main`: `PATCH READY $S/patches/BRIDGE-T3.patch`. Continue with T6's test while waiting.

- [ ] **Step 5: After the root's reply (wasm installed):** run the T3 test (PASS), G-CMP, then flip `obj-module-fn` + `library-fn-in-object` (`today: "pass"`, drop `note`), run G-CORPUS (both flip, no green turns red), G-UI, G-ZC, G-BYTES (≤ +2%; report).

- [ ] **Step 6: Docs.** `libs/compiler/CLAUDE.md` Gotchas: C3 module references (`_rMod` epilogue, `$ref` symbols, value-position rule).

- [ ] **Step 7: Commit** (TS side only; the root committed the Rust) `test(compiler,runtime): module references resume anywhere (Function Bridge T3)`.

---

### Task T4: C4 — escape analysis into captured holders (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-escape.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` (`escaping` :1552, captures fixpoint :2370 — second fixpoint over holders), `$S/patches/BRIDGE-T4.{patch,md}`

**Interfaces:**
- Produces: a local function (arrow / function expression) gets `__rivetR_fn(id, fn, [caps])` when it sits in an **escape position** of a **captured holder**: the holder is a local `const` / `let` captured by any site (fixpoint, spec §9 risk-3 fallback), and the function is the right side of an assignment to the holder or a member of it (`api.inc = …`), an argument of a call or `new` in the holder's initializer (`signal(f)`, `new Map([["k", f]])`, `track([f])`), or an array element there. Consumed callbacks stay plain: arguments of member calls named `map filter forEach reduce reduceRight some every find findIndex findLast findLastIndex flatMap sort toSorted replace replaceAll`, and of `untrack` / `batch` / `runWithOwner` from `@rivetjs/reactivity`.

Expected emission:

```js
// assigned-fn — before: api.inc = () => n.set(n() + 1);   after:
api.inc = __rivetR_fn("src/assigned-fn.tsx#Page$h1", () => n.set(n() + 1), [n]);
// signal-fn — after:
const step = signal(__rivetR_fn("src/signal-fn.tsx#Page$h2", () => n.set(n() + 1), [n]));
// recipe-side-effect (T18 relies on it) — after:
const fns = track([__rivetR_fn("src/recipe-side-effect.tsx#Page$h3", () => n.set(n() + 1), [n])]);
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-escape.test.ts`:

```ts
// Function Bridge T4 (C4): local functions escaping into a captured holder become symbols.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const server = (body: string) => {
  const source = `import { signal } from "@rivetjs/reactivity";
function track<T>(x: T): T { return x; }
export function Page() {
  const n = signal(0);
  ${body}
  return <button onClick={() => go()}>{n()}</button>;
}`;
  const r = compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; diagnostics: unknown[] };
  assert.deepEqual(r.diagnostics, []);
  return r.code.replace(/\s+/g, " ");
};
const ID = String.raw`"src/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;

test("an arrow assigned into a captured object is a symbol", () => {
  const code = server("const api: { inc?: () => void } = {}; api.inc = () => n.set(n() + 1); const go = () => api.inc!();");
  assert.match(code, new RegExp(String.raw`api\.inc = __rivetR_fn\(${ID}, \(\) => n\.set\(n\(\) \+ 1\), \[n\]\)`));
});

test("an arrow passed to signal() / a call / an array in a captured holder's initializer is a symbol", () => {
  assert.match(server("const step = signal(() => n.set(n() + 1)); const go = () => step()();"), new RegExp(String.raw`signal\(__rivetR_fn\(${ID}, \(\) => n\.set`));
  assert.match(server("const fns = track([() => n.set(n() + 1)]); const go = () => fns[0]!();"), new RegExp(String.raw`track\(\[__rivetR_fn\(${ID}, \(\) => n\.set`));
});

test("consumed callbacks and holders no site captures stay plain", () => {
  const code = server("const xs = [1, 2].map((x) => x * 2); const unused = [() => 1]; void unused; const go = () => n.set(xs[0]!);");
  assert.doesNotMatch(code, /__rivetR_fn\([^)]*\(x\) => x \* 2/);
  assert.doesNotMatch(code, /__rivetR_fn\([^)]*\(\) => 1\b/);
});
```

- [ ] **Step 2: Run — expect FAIL** (no wrapper around the assigned / argument arrows).

- [ ] **Step 3: Write the patch.** After the existing captures fixpoint (`analyze` loop), add a holder pass: `holders` = decls captured by any site (`capture_decls`) that are `VariableDeclarator`s; for each holder walk (a) its initializer's call / `new` arguments and array elements recursively (stop at consumed callees), (b) every `AssignmentExpression` in the component whose target is the holder or a member chain rooted at it; each function literal found becomes `Site::new(SiteKind::Fn)` with `closure = Some(function)`, `component`, `value = Some(function)`, `opportunistic = true`, pushed on the queue (so its own captures are analysed and can promote further holders — iterate to a fixpoint). `resume_node` already emits `self.r("fn", …)` for Fn-site arrows (`compile.rs:4529`). Patch `.md`: emission above; verify = flip `assigned-fn`, `signal-fn`; perf note: count new `_rFn` per showcase render (`grep -c __rivetR_fn` on compiled ui showcase modules before / after).

- [ ] **Step 4: Hand off** (`PATCH READY $S/patches/BRIDGE-T4.patch`).

- [ ] **Step 5: After the wasm:** T4 test PASS; G-CMP; flip `assigned-fn`, `signal-fn`; G-CORPUS; G-UI; G-ZC; G-BYTES + encode A/B (spec §9 risk 3: showcase ms ≤ +2%; if over, report and stop).

- [ ] **Step 6: Docs** `libs/compiler/CLAUDE.md` (C4 holder rule + consumed list). **Commit** `test(compiler): escape analysis wraps functions stored in captured holders (Function Bridge T4)`.

---

### Task T4b: C4b — local functions stored by name into captured holders (patch)

Ruling 2026-10-11 (T4 review L3/L2): spec row `:149` (functions stored into objects / arrays / maps resume) covers stores **by name**, which T4 left out. Lane CA, after T4 fix round 1.

**Files:**
- Create: `libs/compiler/tests/resume-bridge-escape-names.test.ts`
- Patch: `libs/compiler/rust/src/resume/escape.rs` (extend the holder-site walk from function literals to identifier references of local function declarations / `const f = () => …` bindings), `$S/patches/BRIDGE-T4b.{patch,md}`

**Interfaces:**
- Consumes: T4 `holder_site` / escape positions, T2 `__rivetR_fn(id, fn, [caps])`, the T4 consumed-callback list, the T4 fix-1 self-/forward-reference rule.
- Produces: a local function *referenced by name* in an escape position of a captured holder (`obj.f = f`, `list.push(f)`, `m.set(k, f)`, `[f]`, `{ f }`, `signal(f)`) gets its recipe at its **declaration** (`const f = __rivetR_fn("<unit>#Page$<hash>", () => …, [caps])`, content-hash id (C2); `function f(){}` → hoisted declaration kept, recipe stamped once after the declaration via `__rivetR_fn(id, f, [caps])` returning `f`), never per store site, so one function has one id. Holders reached through data (`const outer = { inner }` where `inner` is a captured holder) are searched transitively (second fixpoint over holder aliases).

Expected emission:

```js
// before
const open = () => n.set(n() + 1);
const api = {}; api.open = open; list.push(open);
// after (landed, T4b): one recipe at the declaration, stores unchanged
const open = __rivetR_fn("src/by-name.tsx#Page$<hash>", () => n.set(n() + 1), [n]);
const api = {}; api.open = open; list.push(open);
// function declaration: kept (hoisted); T4b stamped it once right after itself — superseded by T6:
// registered at the top of the enclosing body with thunk captures
__rivetR_fn("src/by-name.tsx#Page$<hash>", open, () => [n]); /* …body top… */
api.open = open; function open() { n.set(n() + 1); }
// the onClick handler is its own site: __rivetR_on("click", "src/by-name.tsx#Page$<hash>", [api])
```

- [x] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-escape-names.test.ts` (as landed: the first draft guessed the emission — `$h<n>` ids, single-line output, the handler as an `__rivetR_fn`; assertions adapted to content-hash ids, normalized whitespace and `__rivetR_on`, intent unchanged):

```ts
// Function Bridge T4b (C4b): local functions stored by name into captured holders become symbols.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// Adapted from the brief: output whitespace normalized (the printer splits blocks over lines), ids are content hashes
// (`Page$<base36>`, Function Bridge C2) and the onClick handler is an `__rivetR_on` site, not `__rivetR_fn`.
const server = (body: string, handler = "api.open()") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n  return <button onClick={() => ${handler}}>{n()}</button>;\n}`,
    { filename: "src/by-name.tsx", target: "server", resume: { module: "src/by-name.tsx" } },
  ).code.replace(/\s+/g, " ");
const ID = String.raw`"src/by-name\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;

test("const arrow stored by name into a captured holder gets one recipe at its declaration", () => {
  const out = server("  const open = () => n.set(n() + 1);\n  const api = {}; api.open = open; const list = []; list.push(open);");
  assert.match(out, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(n\(\) \+ 1\), \[n\]\);`));
  assert.match(out, /api\.open = open;/);
  // One recipe for `open` (never per store) and exactly one more resume site, the onClick handler (`__rivetR_on`).
  assert.equal(out.match(/__rivetR_fn\(/g)?.length, 1);
  assert.equal(out.match(/__rivetR_on\(/g)?.length, 1);
});

test("function declaration stored by name is stamped once at the top of the body (T6)", () => {
  const out = server("  const api = {}; api.open = open; function open() { n.set(n() + 1); }");
  // Function Bridge T6: the registration moved from right after the declaration to the body top, captures as a thunk.
  assert.match(out, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, open, \(\) => \[n\]\); const n = signal\(0\);`));
  assert.match(out, /function open\(\) \{ n\.set\(n\(\) \+ 1\); \} return /);
  // Hoisting kept: still a declaration, assigned before it; stamped once.
  assert.match(out, /api\.open = open; function open\(\)/);
  assert.equal(out.match(/__rivetR_fn\(/g)?.length, 1);
});

test("holder reached through data is searched", () => {
  const out = server("  const inner = {}; const outer = { inner }; inner.go = () => n.set(1); const api = { open: () => outer.inner.go() };");
  assert.match(out, /inner\.go = __rivetR_fn\(/);
});

test("a function used only in a consumed call is not stamped", () => {
  const out = server("  const tick = () => n.set(n() + 1); setTimeout(tick, 10); const api = { open: () => {} };");
  assert.doesNotMatch(out, /const tick = __rivetR_fn\(/);
});

test("store calls on a captured holder: push, Map set, a signal holding a function", () => {
  const pushed = server("  const open = () => n.set(1); const list: (() => void)[] = []; list.push(open);", "list[0]!()");
  assert.match(pushed, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
  const mapped = server('  const open = () => n.set(1); const m = new Map<string, () => void>(); m.set("k", open);', 'm.get("k")!()');
  assert.match(mapped, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
  const held = server("  const open = () => n.set(1); const step = signal<() => void>(() => {}); step.set(open);", "step()()");
  assert.match(held, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
});

test("a named function whose capture is in its TDZ at the declaration stays plain", () => {
  const later = server("  const api: { open?: () => void } = {}; const open = () => stop(); api.open = open; const stop = () => n.set(0);", "api.open!()");
  assert.match(later, /const open = \(\) => stop\(\);/);
});
```

- [ ] **Step 2: Run** `bash $S/heavy.sh npx vitest run --project compiler --maxWorkers=1 resume-bridge-escape-names` — expected: FAIL (no recipe on `open`).
- [ ] **Step 3: Patch** `escape.rs`: collect local function bindings (`const f = <fn literal>`, `function f`); in the holder-site walk, treat an `Identifier` that resolves to such a binding in an escape position as a stamp request for the *binding* (dedupe by binding id); emit the recipe at the declaration (arrow: wrap initializer; declaration: insert `__rivetR_fn(id, f, caps);` statement after it). Holder aliases: a `const x = { …holder… }` / `[holder]` / `x = holder` makes `x` a holder for the next fixpoint pass. Reuse the T4 fix-1 self-/forward-reference rule and the consumed list.
- [ ] **Step 4: Build** via root (patch flow), install, run compiler suite + oracle (`npx nx run compiler:parity`; re-record only intended cases and list them) + corpus; the T4 tests stay green; zero-cost corpus line unchanged except intended flips.
- [ ] **Step 5: Docs**: `docs/guides/resumability.md` + `apps/docs/content/learn/resuming.md` + `libs/mcp/ai/agents.md` (sync) now say "stored by name or inline"; compiler CLAUDE.md + rust CLAUDE.md escape section.
- [ ] **Step 6: Commit** `feat(compiler): local functions stored by name into captured holders (Function Bridge T4b)` with the Rust-by-root line + trailer.

### Task T5: Thunk (late) captures in `_rFn`

**Files:**
- Create: `libs/runtime/tests/bridge-late.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`Captures` type :208, `FnMeta.captures`, `_rFn`, every `meta.captures` read in `special` / `fnEntry` / `forwardSources`)

**Interfaces:**
- Produces: `_rFn<F>(id: string, fn: F, captures: Captures | (() => Captures), member?: number): F` — a thunk is called once, at the entry's first encode (end of the render / segment), and replaced by its result (`capturesOf(meta)`).

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-late.test.ts`:

```ts
// Function Bridge T5: `_rFn` captures given as a thunk are read once, at encode time (hoisted registrations, TDZ).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rFn } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

test("thunk captures see values assigned after registration, and run once", async () => {
  let reads = 0;
  const { values } = await roundTrip(
    () => {
      let label = "early";
      const f = _rFn("m.tsx#P$f", () => label, () => (reads++, [label]));
      label = "late";
      return [f, { f }];
    },
    { "m.tsx#P$f": (label: never) => "revived:" + label },
  );
  assert.equal(values[0], "revived:late");
  assert.equal((values[1] as { f: unknown }).f, values[0]);
  assert.equal(reads, 1);
});
```

- [ ] **Step 2: Run — expect FAIL** (`captures.map is not a function` at encode).

- [ ] **Step 3: Implement.**

```ts
type Captures = readonly unknown[];
/** `_rFn` captures: the array, or a thunk the encoder calls once (hoisted declarations: their captures are in TDZ at registration). */
type LateCaptures = Captures | (() => Captures);
```

`FnMeta.captures: LateCaptures`; add below `metaOf`:

```ts
const capturesOf = (meta: FnMeta): Captures => (typeof meta.captures === "function" ? (meta.captures = meta.captures()) : meta.captures);
```

Replace every read: `grep -n "meta\.captures\|\.captures\.map(\|refs(meta\.captures" libs/runtime/server-resume.ts` → `capturesOf(meta)` (keep `_rProps` children concat working: it builds arrays, never thunks). `_rFn(id, fn, captures: LateCaptures)`.

- [ ] **Step 4: PASS; G-RT, G-ZC (report hash), G-BYTES (identical).**

- [ ] **Step 5: Docs** `libs/runtime/CLAUDE.md` (`_rFn` thunk captures). **Commit** `feat(runtime): _rFn late (thunk) captures (Function Bridge T5)`.

---

### Task T6: C5 — hoisted declaration registrations (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-hoist.test.ts`
- Patch: `libs/compiler/rust/src/compile.rs` (`resume_node` function-declaration Fn sites; body prologue insertion), `libs/compiler/rust/src/resume.rs` (mark `hoisted` on Fn sites whose closure is a `FunctionDeclaration`), `$S/patches/BRIDGE-T6.{patch,md}`

**Interfaces:**
- Consumes: T5 thunk captures.
- Produces: every function-declaration Fn site registers at the **top of its enclosing function body**: `__rivetR_fn("<id>", <name>, () => [<caps>]);` (thunk always); no registration at the declaration's position.

Expected emission:

```js
// hoisted-declaration — after (server)
export function Page() {
  __rivetR_fn("src/hoisted-declaration.tsx#Page$h4", bump, () => [n]);
  const n = signal(0);
  return …__rivetR_on("click", "src/hoisted-declaration.tsx#Page$h5", [bump])…;
  function bump() { n.set(n() + 1); }
}
// mutual-recursion (groups arrive in T10) keeps one registration per declaration here
```

As landed (2026-10-11): ids are content hashes (`Page$<base36>`, not `$h4`), the registration is emitted for every function-declaration Fn site (captured local function, T4b stored by name). "Top of the enclosing body" = the declaration's statement list: function body, block, class static block or `case` clause (module code is strict, so a block / clause declaration is not visible further up); directives stay first; source order. `resume.rs` `Site.hoisted` + `hoist_container`, `compile/resume_hoist.rs` (`hoisted_containers`, `hoisted_body`); `escape.rs` `named_site` drops its TDZ skip for such declarations (the thunk reads captures at the first encode). Oracle unchanged (227/227). Known gap: a declaration in one `case` clause called from another clause without executing its own clause first is not registered (fails at encode, as before). Tests: the two brief tests verbatim + source order / directives, block and `case` scopes, T4b stored-by-name + capture declared later, DOM unchanged, executed encodes (after `return`, early `return` in `if`, `throw`, capture declared later); T4b review M1 executed case in `resume-bridge-escape-names.test.ts` flipped.

- [x] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-hoist.test.ts`:

```ts
// Function Bridge T6 (C5): function declarations register at the top of their body, captures as a thunk.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const ID = String.raw`"src/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;
const server = (source: string) => (compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string }).code.replace(/\s+/g, " ");

test("a declaration after return registers first, with thunk captures", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  return <button onClick={() => bump()}>{n()}</button>;
  function bump() { n.set(n() + 1); }
}`);
  assert.match(code, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, bump, \(\) => \[n\]\); const n = signal\(0\);`));
  assert.equal(code.split("__rivetR_fn(").length - 1, 1);
});

test("a declaration before use registers at the top too", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  function bump() { n.set(n() + 1); }
  return <button onClick={() => bump()}>{n()}</button>;
}`);
  assert.match(code, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, bump, \(\) => \[n\]\);`));
});
```

- [x] **Step 2: Run — expect FAIL.**
- [x] **Step 3: Write the patch.** In `resume.rs` set `site.hoisted = true` for Fn sites with `tree.decl_kind(closure) == FunctionDeclaration`. In `compile.rs`, when lowering a function body that contains hoisted sites, emit `self.r("fn", vec![site_str, Expr::ident(name), Expr::Raw(format!("() => {}", capture_list.print()))])` + `;` as the first statements (source order of the declarations), and drop the declaration-position registration. DOM target unchanged. `.md`: emission above; verify = flip `hoisted-declaration`; oracle: resume snapshots with captured function declarations change (registration moves) — as landed none of the 227 cases holds one: unchanged.
- [x] **Step 4: Hand off.**
- [x] **Step 5: After the wasm:** test PASS; G-CMP; flip `hoisted-declaration`; G-CORPUS; G-UI; G-ZC; G-BYTES.
- [x] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md` (hoisted registrations); landed as one commit `feat(compiler): hoisted function-declaration registrations at body top (Function Bridge T6)` (TS + Rust + wasm).

---

### Task T7: `let` cells runtime (`_rCell`, Q2 dev warning)

**Files:**
- Create: `libs/runtime/tests/bridge-cells.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`_rCell`, `special`, `opaque`), `libs/runtime/resume-format.ts` (decoder branch before `"k" in entry`, `EntryRecord` doc), `libs/runtime/docs/resume.md`

**Interfaces:**
- Produces: `export function _rCell<T>(value: T): { v: T }` (server-resume). Encodes `{k: "cell", a: [valueRef]}` at its **first** encode (interned: every capture shares it); later server writes keep the encoded value and warn once in dev (Q2). Decoder: `{ v }` plain object, two-phase (the value may reach the cell).

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-cells.test.ts`:

```ts
// Function Bridge T7: `let` cells (`_rCell`) are shared by every capture, encoded at their first encode (Q2).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rCell, _rFn } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

const DEV_RUN = process.execArgv.includes("--conditions=development");

test("one cell captured twice decodes to one browser cell with the value at encode", async () => {
  const { values } = await roundTrip(() => {
    const clicks = _rCell(0);
    clicks.v = 2;
    return [clicks, { clicks }];
  });
  const [a, b] = values as [{ v: number }, { clicks: { v: number } }];
  assert.equal(a.v, 2);
  assert.equal(b.clicks, a);
  a.v++;
  assert.equal(b.clicks.v, 3);
});

test("a cell holding a function that captures the cell decodes (two-phase)", async () => {
  const { values } = await roundTrip(
    () => {
      const cell = _rCell<unknown>(null);
      cell.v = _rFn("m.tsx#P$g", () => cell, [cell]);
      return [cell];
    },
    { "m.tsx#P$g": (cell: never) => () => cell },
  );
  const cell = values[0] as { v: () => unknown };
  assert.equal(cell.v(), cell);
});

test("a server write after the first encode keeps the encoded value; dev warns", async () => {
  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args);
  let late: { v: number } | undefined;
  try {
    const { values } = await roundTrip(() => {
      late = _rCell(1);
      return [late];
    });
    late!.v = 5;
    assert.equal((values[0] as { v: number }).v, 1);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, DEV_RUN ? 1 : 0);
});
```

- [ ] **Step 2: Run — expect FAIL** (`_rCell` missing).

- [ ] **Step 3: Implement** in `server-resume.ts`:

```ts
// Function Bridge (plan T7): a boxed `let` (compiler C6: `let x = 0` → `const x = _rCell(0)`, reads / writes `x.v`) in a
// resume module's server render. Encoded once, at its first encode (`{k:"cell", a:[value]}`, interned: every symbol capturing
// it shares one browser cell) — Q2: later server writes (an `Async` continuation) do not reach the page; dev warns once.
class LetCell<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
}
class DevLetCell<T> {
  #v: T;
  #sealed = false;
  constructor(v: T) {
    this.#v = v;
  }
  get v(): T {
    return this.#v;
  }
  set v(next: T) {
    if (this.#sealed) {
      this.#sealed = false;
      console.warn("Rivet resume: a captured `let` was assigned after the page state was written; the browser keeps its earlier value");
    }
    this.#v = next;
  }
  seal(): void {
    this.#sealed = true;
  }
}
export function _rCell<T>(value: T): { v: T } {
  return DEV ? new DevLetCell(value) : new LetCell(value);
}
```

In `special`, first statement of the non-function branch:

```ts
      if (value instanceof LetCell || (DEV && value instanceof DevLetCell)) {
        if (DEV) (value as DevLetCell<unknown>).seal();
        return { k: "cell", a: [ref((value as { v: unknown }).v)] };
      }
```

In `opaque` add `value instanceof LetCell || value instanceof DevLetCell ||`. In `resume-format.ts` `createDecoder` `get`, directly before `if ("k" in entry) {`:

```ts
    // `let` cell (Function Bridge): created before its value decodes, so a function in it may capture the cell.
    if (entry.k === "cell") {
      const cell: { v: unknown } = (memo[index] = { v: undefined });
      cell.v = get(entry.a![0]!);
      return cell;
    }
```

- [ ] **Step 4: PASS (both projects); G-RT; G-ZC; G-SIZE (dom-resume delta, report); G-BYTES identical.**
- [ ] **Step 5: Docs** `libs/runtime/CLAUDE.md` + `docs/resume.md` (`{k:"cell"}`, Q2). **Commit** `feat(runtime): resumable let cells (Function Bridge T7)`.

---

### Task T8: C6 — boxed `let` cells (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-cells.test.ts`
- Patch: `libs/compiler/rust/src/compile/resume_cells.rs` (new: which `let`s box, rewrite plan), `libs/compiler/rust/src/resume.rs` (capture kind `cell`), `libs/compiler/rust/src/compile.rs` (server declarator + read / write rewrite; symbol text rewrite), `$S/patches/BRIDGE-T8.{patch,md}`

**Interfaces:**
- Consumes: T7 `_rCell`.
- Produces: a `let` in a resume component that is captured by a site and is (a) assigned inside any closure, or (b) assigned after the first capture site in source order, compiles — **server target**: `const x = __rivetR_cell(init)`, every read `x.v`, every write / update `x.v = …` / `x.v++`; **symbol modules**: the same `.v` rewrite of the captured name; **DOM main module**: unchanged. Capture kind `"cell"` (check / editor sites).

Expected emission:

```js
// let-shared-cell — server after
const clicks = __rivetR_cell(0);
… __rivetR_on("click", "src/let-shared-cell.tsx#Page$h6", [clicks]) … __rivetR_on("click", "…#Page$h7", [out, clicks]) …
// symbols: export const Page$h6 = (clicks) => () => { clicks.v++; };
//          export const Page$h7 = (out, clicks) => () => out.set(String(clicks.v));
// let-after-jsx — server after
const label = __rivetR_cell("early"); const view = (…[out, label]…); label.v = "late"; return view;
// let-before (green, unchanged): let step = 1; step = 5;   (no site before the write, no closure write)
```

As landed (2026-10-11): `rust/src/resume/cells.rs` (`boxed_lets` + `Cells.edits`; decides in `analyze`, so symbol texts of both targets carry the `.v` edits and ids agree) + `rust/src/compile/resume_cells.rs` (`let` → `const`) + `resume_node` hooks (declarator `x = __rivetR_cell(init)`, references from `Resumed.cell_refs`). Box rule as above plus: a write sharing a loop with a capturing closure that does not contain the declaration; never a `for` head, `var`, pattern, JSX tag / `<slot>` use, or a `let` captured by a Spread / Styled / Props / Element site. Callees `(0, x.v)(…)`, shorthand / destructuring shorthand `x: x.v`. Capture kind `"cell"` (check sites, TS plugin hover). Also landed: T4b review L1 (spreads stored), L2 (`rejected` memo), L3 (lazy closure set), L5 superseded; T6 review M1 (`hoisted_at.remove`, infallible `hoisted_body`, pending-site fallback stamp — unreachable today, documented as a guard in `rust/CLAUDE.md`). Extra corpus case `holder-let-later` (pass). Oracle unchanged (227/227). Cost: 36 cells in 1441 ui-docs example + ui + cdk modules, `__rivetR_fn` 8461 unchanged. `libs/runtime/tests/bridge-late.test.ts` sources use `var label` (the T5 thunk tests, not cells). Landed as one commit `feat(compiler): boxed let cells for captured mutable locals (Function Bridge T8)` (TS + Rust + wasm).

Fix round 1 (T8 review, 2026-10-11): H1 — the box rule is order-independent: any write anywhere in the declaring function (nested functions, methods, class field initializers included) boxes (the hoisted-declaration and class-field inputs decoded `0` instead of the late value); the loop rule is subsumed. M1 — an Event / ClientEvent / Ref / Model site whose expression is not a function literal captures the value (`[h.v]`, kind `value`, no symbol edit; `Cells.snapshots`), restoring pre-T8 handler-by-name semantics. L2 — a function calling a direct `eval` boxes none of its `let`s. L1 — `bridge-late` keeps one `let` twin of the streamed Suspense case. L3 — a `for (let i…)` head written in the body after the capturing closure stays a snapshot (documented; per-iteration cells = follow-up). L5 — G-CORPUS `let-hoisted-after-write`, `let-class-field-write`, `let-handler-by-name`, `let-multi-declarator`, `let-non-ascii`, `let-destructure-server`, `let-for-row`, `let-loop-body` (pass). Also: the `slots::rewrite_fragment` dead_code warning removed.

Fix round 2 (T8 re-review M2): an eager handler expression snapshots a boxed `let` only when no reference lies in a function nested in it; `onClick={p.on ? () => { x++ } : undefined}` keeps the shared cell (executed test + G-CORPUS `let-eager-nested-arrow`). Limit: an eager reference beside such a nested one reads the cell at resume.

- [x] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-cells.test.ts`:

```ts
// Function Bridge T8 (C6): captured `let`s written in closures / after a capture site become shared cells.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

type Sym = { kind: string; component: string; source: string };
const run = (source: string, target: "server" | "dom") =>
  compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; symbols: Sym[]; diagnostics: unknown[] };
const shared = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("0");
  let clicks = 0;
  return (<section><span>{out()}</span>
    <button class="go" onClick={() => { clicks++; }}>go</button>
    <button class="show" onClick={() => out.set(String(clicks))}>show</button></section>);
}`;

test("server: the let becomes a cell; reads and writes go through .v", () => {
  const code = run(shared, "server").code.replace(/\s+/g, " ");
  assert.match(code, /const clicks = __rivetR_cell\(0\);/);
  assert.doesNotMatch(code, /let clicks/);
});

test("symbols rewrite the captured let to .v; the DOM main module keeps the plain let", () => {
  const dom = run(shared, "dom");
  assert.match(dom.code, /let clicks = 0/);
  const sources = dom.symbols.map((s) => s.source).join("\n");
  assert.match(sources, /clicks\.v\+\+/);
  assert.match(sources, /String\(clicks\.v\)/);
});

test("a let written only before any capture site stays plain", () => {
  const code = run(`import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); let step = 1; step = 5; return <button onClick={() => n.set(n() + step)}>{n()}</button>; }`, "server").code;
  assert.doesNotMatch(code, /__rivetR_cell/);
});
```

- [x] **Step 2: Run — expect FAIL.**
- [x] **Step 3: Write the patch** (`resume_cells.rs`): `pub fn boxed_lets(tree, resumed) -> FxHashSet<NodeId>` = `let` declarators captured by a site with an assignment / update whose span is inside any function nested in the component, or whose start is after the first capture site's start; `compile.rs` server visit of a boxed declarator → `const <name> = <r("cell", [init or undefined])>`; every `IdentifierReference` / `SimpleAssignmentTarget` bound to it → `<name>.v` (shorthand properties `{ x }` → `{ x: x.v }`); symbol `source` text rewritten the same way (`slots::rewrite`-style span edits over the closure text); capture kind `"cell"` in `capture_kinds`. `.md`: emission above; verify = flip `let-shared-cell`, `let-after-jsx`; oracle: snapshots with such `let`s change.
- [x] **Step 4: Hand off.**
- [x] **Step 5: After the wasm:** test PASS; G-CMP; flip `let-shared-cell` + `let-after-jsx`; G-CORPUS (`let-before` stays green); G-UI; G-ZC; G-BYTES.
- [x] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md` (cell rule, D13); `test(compiler): captured let cells (Function Bridge T8)`.

---

### Task T9: `.bind` + group member entries (runtime)

**Files:**
- Create: `libs/runtime/tests/bridge-shapes.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`_rBound`, `_rFn` `member`, `special` / `fnEntry`, `compactTable` keeps `gm`), `libs/runtime/resume-format.ts` (`EntryRecord.gm`, `full()` copies `gm`, decoder group memo), `libs/runtime/dom-resume.ts` (custom `bind`)

**Interfaces:**
- Produces: `export function _rBound<F extends (...a: never[]) => unknown>(fn: F, self: unknown, args: readonly unknown[]): F` — returns `fn.bind(self, ...args)`, encodes `{k: "bind", a: [fnRef, selfRef, ...argRefs]}`; browser: `fn.bind(self, ...args)`.
- Produces: `_rFn(id, fn, captures, member?: number)`: group members share `id` + captures; entry `{f: id, a, gm: member}`; the decoder runs the group factory once per (symbol, capture refs) and takes element `gm` of the returned array.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-shapes.test.ts`:

```ts
// Function Bridge T9: `.bind` partial application and mutually recursive group members.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rBound, _rFn } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

test("a bound resumable function revives as fn.bind(self, ...args)", async () => {
  const { values } = await roundTrip(
    () => {
      const add = _rFn("m.tsx#P$add", (by: number) => by * 10, []);
      return [_rBound(add, null, [2])];
    },
    { "m.tsx#P$add": () => (by: number) => by * 10 },
    { custom: (kind, args) => (kind === "bind" ? (args[0] as (...a: unknown[]) => unknown).bind(args[1], ...args.slice(2)) : undefined) },
  );
  assert.equal((values[0] as () => number)(), 20);
});

test("group members run the group factory once and keep identity", async () => {
  let runs = 0;
  const factory = () => {
    runs++;
    const even = (k: number): boolean => (k === 0 ? true : odd(k - 1));
    const odd = (k: number): boolean => (k === 0 ? false : even(k - 1));
    return [even, odd];
  };
  const { values, state } = await roundTrip(
    () => {
      const [even, odd] = factory();
      runs = 0;
      return [_rFn("m.tsx#P$g", even, [], 0), _rFn("m.tsx#P$g", odd, [], 1), { even: _rFn("m.tsx#P$g", even, [], 0) }];
    },
    { "m.tsx#P$g": factory },
  );
  assert.ok(state.t.some((e) => (e as { gm?: number } | null)?.gm === 1));
  const [even, odd, holder] = values as [(k: number) => boolean, (k: number) => boolean, { even: unknown }];
  assert.equal(even(10), true);
  assert.equal(odd(3), true);
  assert.equal(holder.even, even);
  assert.equal(runs, 1);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** `FnMeta` gains `member?: number`; `_rFn(id, fn, captures, member?)` stores it. `fnEntry` / `special` final branch: `const entry: EntryRecord = { f: meta.id, a: capturesOf(meta).map(ref) }; if (meta.member !== undefined) entry.gm = meta.member; return entry;`. Bound:

```ts
// `.bind` of a resumable function (compiler C9 rewrites `f.bind(t, ...args)`): `{k:"bind", a:[f, t, ...args]}`.
const bounds = new WeakMap<object, readonly unknown[]>();
export function _rBound<F extends (...a: never[]) => unknown>(fn: F, self: unknown, args: readonly unknown[]): F {
  const bound = (fn as (...a: unknown[]) => unknown).bind(self, ...args) as F;
  if (store.getStore() ?? unrecordedRender) bounds.set(bound, [fn, self, ...args]);
  return bound;
}
```

and in `special` function branch before `return fnEntry(value, ref);`: `const bound = bounds.get(value); if (bound) return { k: "bind", a: bound.map(ref) };`. `resume-format.ts`: `EntryRecord` doc + `gm?: number` ("group member index of a `f` entry: the symbol returns the group's functions"); `full()`: `if (entry.gm !== undefined) out.gm = entry.gm;`; server `compactTable` must copy `gm` like `q` / `v` (find it with `grep -n "function compactTable" server-resume.ts`). Decoder c/f branch:

```ts
    if ("c" in entry || "f" in entry) {
      const kind = "c" in entry ? "computed" : "fn";
      const hook = need(kind);
      memo[index] = BUSY;
      try {
        if (entry.gm !== undefined) {
          const key = String(entry.f) + "\0" + entry.a!.join(",");
          let group = groups.get(key);
          if (group === undefined) groups.set(key, (group = hook(entry.f as SymbolRef, entry.a!.map(get), undefined) as unknown[]));
          return (memo[index] = group[entry.gm]);
        }
        return (memo[index] = hook((entry.c ?? entry.f) as SymbolRef, entry.a!.map(get), equality(entry.q), entry.v));
      } catch (error) {
        delete memo[index];
        throw error;
      }
    }
```

with `const groups = new Map<string, unknown[]>();` next to `memo`. `dom-resume.ts` custom hook: `if (kind === "bind") return (args[0] as (...a: unknown[]) => unknown).bind(args[1], ...args.slice(2));`.

- [ ] **Step 4: PASS; G-RT; G-ZC; G-SIZE; G-BYTES identical.**
- [ ] **Step 5: Docs + commit** (`docs/resume.md` `{k:"bind"}`, `gm`; runtime CLAUDE.md) `feat(runtime): bind + function group entries (Function Bridge T9)`.

---

### Task T10: C8 group symbols + C9 `.bind` rewrite (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-groups.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` (fixpoint :2370 — strongly connected Fn sites → one group site), `libs/compiler/rust/src/compile.rs` (`.bind` call rewrite on the server target), `$S/patches/BRIDGE-T10.{patch,md}`

**Interfaces:**
- Consumes: T9 `_rFn` member, `_rBound`; T6 hoisting.
- Produces: mutually recursive local Fn sites (capture cycle between ≥ 2 local functions) → one group symbol `export const <Name> = (<union of outer captures>) => { <declarations / consts in source order> return [<members>]; };`; each member registers `__rivetR_fn("<group id>", <member>, () => [<caps>], <index>)` (hoisted, T6). `f.bind(t, ...args)` where `f` is a local / module function the analysis made resumable → server `__rivetR_bound(f, t, [args])`; DOM main unchanged.

Expected emission:

```js
// mutual-recursion — server after
export function Page() {
  __rivetR_fn("src/mutual-recursion.tsx#Page$g1", even, () => [], 0);
  __rivetR_fn("src/mutual-recursion.tsx#Page$g1", odd, () => [], 1);
  const n = signal(0); function even(k) {…} function odd(k) {…} …
}
// symbol: export const Page$g1 = () => { function even(k) { … odd(k - 1); } function odd(k) { … even(k - 1); } return [even, odd]; };
// bound-fn — server after
const add = __rivetR_fn("…#Page$h8", (by) => n.set(n() + by), [n]); const inc = __rivetR_bound(add, null, [2]);
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-groups.test.ts`:

```ts
// Function Bridge T10 (C8 + C9): mutual recursion → one group symbol; `.bind` → `_rBound`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const run = (source: string, target: "server" | "dom") =>
  compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; symbols: { id: string; source: string }[] };
const recursion = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  function even(k: number): boolean { return k === 0 ? true : odd(k - 1); }
  function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }
  return <button onClick={() => n.set(even(10) ? 2 : 1)}>{n()}</button>;
}`;

test("mutually recursive declarations share one group symbol with member indexes", () => {
  const code = run(recursion, "server").code.replace(/\s+/g, " ");
  const m = /__rivetR_fn\(("src\/a\.tsx#Page\$[0-9a-z_]+"), even, \(\) => \[\], 0\); __rivetR_fn\(\1, odd, \(\) => \[\], 1\);/.exec(code);
  assert.ok(m, code);
  const group = run(recursion, "dom").symbols.find((s) => JSON.stringify(s.id) === m![1])!;
  assert.match(group.source.replace(/\s+/g, " "), /return \[even, odd\]; \};$/);
});

test(".bind of a resumable local becomes _rBound on the server only", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); const add = (by: number) => n.set(n() + by); const inc = add.bind(null, 2);
  return <button onClick={() => inc()}>{n()}</button>; }`;
  assert.match(run(source, "server").code, /const inc = __rivetR_bound\(add, null, \[2\]\)/);
  assert.match(run(source, "dom").code, /add\.bind\(null, 2\)/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch.** After the fixpoint, Tarjan SCC over Fn sites with edges = captures of kind `fn` pointing to another local Fn site; each SCC of size ≥ 2 → one `Site { kind: Fn, group: members }` whose symbol body concatenates the member declarations' text (`const x = …` for arrow members) in source order and returns `[members]`; its captures = union of members' non-member captures (sorted by first use); members' sites keep their decl key but share the id and get `member: i` (emitted as the 4th `fn` argument, hoisted with thunk captures). C9: in `compile.rs` server visit of a `CallExpression` whose callee is `StaticMemberExpression(.bind)` over an identifier resolving to a Fn site (or `_rMod` reference) → `self.r("bound", [object, args[0] or undefined, Array(args[1..])])`. Also ensure the bound const is **not** a recipe const (skip `fn_closure` for initializers that are a `.bind` call). `.md`: emission above; verify = flip `mutual-recursion`, `bound-fn`.
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip `mutual-recursion` (drop `todayDev` too) + `bound-fn`; G-CORPUS; G-UI; G-ZC; G-BYTES.
- [ ] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md`; `test(compiler): group symbols and bind (Function Bridge T10)`.

---

### Task T11: C7 — narrow member captures for every site kind (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-narrow.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` (`member_captures` :1870 — call it for Event / Bind / Attr / Fn / Effect / ClientEvent / Computed sites, not only Spread / Styled), `libs/compiler/rust/src/compile.rs` (`capture_list` registers `member` like `spread_captures`), `$S/patches/BRIDGE-T11.{patch,md}`

**Interfaces:**
- Produces: a captured local whose every use in the closure is a static member read chain (`store.count`, `store.count.set`) is captured per first-level path: server `__rivetR_member(store, "count")`, symbol param `store$count`, prologue `const store = { count: store$count };` (`__rivetMembers({ … })` when a value may be a forward box: props objects, as today). Whole object on: value use, method call that may use `this` (`store.inc()`), computed key, spread, write, `in` / `delete`, iteration.

Expected emission:

```js
// narrow-object — server after
… __rivetR_on("click", "src/narrow-object.tsx#Page$h9", [__rivetR_member(store, "count")]) …
// symbol: export const Page$h9 = (store$count) => { const store = { count: store$count }; return () => store.count.set(store.count() + 1); };
// method-this (green) keeps [store]: store.inc() may use `this`
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-narrow.test.ts`:

```ts
// Function Bridge T11 (C7): member-only captures are narrowed for handlers and bindings too.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const run = (call: string, target: "server" | "dom") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); const store = { count: n, blob: "BIG", inc() { this.count.set(this.count() + 1); } };
  return <button onClick={() => ${call}}>{n()}</button>; }`,
    { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as { code: string; symbols: { kind: string; captures: string[]; source: string }[] };

test("a handler reading store.count captures that path only", () => {
  assert.match(run("store.count.set(store.count() + 1)", "server").code, /__rivetR_member\(store, "count"\)/);
  const handler = run("store.count.set(store.count() + 1)", "dom").symbols.find((s) => s.captures.includes("store$count"))!;
  assert.match(handler.source, /const store = \{ count: store\$count \};/);
});

test("a method call keeps the whole object", () => {
  const server = run("store.inc()", "server").code;
  assert.doesNotMatch(server, /__rivetR_member\(store/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch** (generalise the Spread / Styled call site of `member_captures` to all site kinds in `analyze` after captures are final; `capture_list` already emits `member(i, c)` when `site.members[i]` is set; add `member` to `used_resume` there too; ensure symbol `params` / `prologue` are emitted for every kind — the `analyze` symbol builder already prefixes `site.prologue`). `.md`: emission above; verify = flip `narrow-object`; perf: G-BYTES on showcases is the key number (capture lists change across cdk / ui).
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip `narrow-object`; G-CORPUS (`method-this`, `getter-object`, `narrow-props` stay green); G-UI; G-ZC; G-BYTES (expect ≤ 0 or within +2%; report per page).
- [ ] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md`; `test(compiler): narrow member captures for all sites (Function Bridge T11)`.

---

### Task T12: Store path narrowing runtime

**Files:**
- Create: `libs/runtime/tests/bridge-store.test.ts`
- Modify: `libs/reactivity/store.ts` (`_storePaths`, whole-read flag), `libs/runtime/server-resume.ts` (`_rStorePaths`, `special`), `libs/runtime/resume-format.ts` (doc of `{k:"store"}`), `libs/runtime/dom-resume.ts` (custom `store`), `libs/reactivity/CLAUDE.md`

**Interfaces:**
- Produces (reactivity, ABI): `export function _storePaths(store: object): string[] | null` — absolute paths of the store's nodes created by reads so far (cache keys), `null` when the store was read whole (`read(store)` / a root view) since creation.
- Produces (runtime): `export function _rStorePaths<S extends object>(store: S, paths: readonly string[]): S` — marks the store for this render with the literal paths captured code uses (compiler C11). A marked store encodes `{k: "store", a: [prunedDataRef, nodesRef]}` where pruned data keeps containers along (server-read paths ∪ literal paths) and leaf values by identity; unmarked / whole-read stores encode as today.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-store.test.ts`:

```ts
// Function Bridge T12: captured stores ship only the paths read on the server or named literally in captured code.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createStore, read, write } from "@rivetjs/reactivity/store";
import { _rStorePaths } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

const custom = (kind: string, args: unknown[]) => (kind === "store" ? { ...(args[1] as object), v: args[0] } : undefined);

test("a marked store drops paths nobody reads", async () => {
  const { html, values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ count: 0, blob: "BIGDATA".repeat(50), user: { name: "ada", bio: "LONGBIO" } }), ["count"]);
      read(store, "user.name");
      return [store];
    },
    {},
    { custom },
  );
  assert.doesNotMatch(html, /BIGDATA|LONGBIO/);
  const store = values[0] as Parameters<typeof read>[0];
  assert.equal(read(store, "count" as never), 0);
  assert.equal(read(store, "user.name" as never), "ada");
  write(store, "count" as never, ((c: number) => c + 1) as never);
  assert.equal(read(store, "count" as never), 1);
});

test("a whole read on the server ships the whole store", async () => {
  const { html } = await roundTrip(() => {
    const store = _rStorePaths(createStore({ count: 0, blob: "BIGDATA" }), ["count"]);
    read(store);
    return [store];
  });
  assert.match(html, /BIGDATA/);
});
```

(the decoded `v` arrives as a decoded signal via the helper's fake signal hook; `read` / `write` call it and `.set` it.)

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** `store.ts`:

```ts
// Resume ABI (Function Bridge T12): roots read whole since creation (`read(store)` / a root view), for `_storePaths`.
const wholes = new WeakSet<Node>();
/** Absolute paths of the nodes reads created so far, or null when the store was read whole (server-resume narrowing). */
export function _storePaths(store: StoreLike<any>): string[] | null {
  const [root, prefix] = split(store);
  if (prefix !== "" || wholes.has(root)) return null;
  return [...(caches.get(root)?.keys() ?? [])];
}
```

and in `node(root, path)`: `if (path === "") { wholes.add(root); return root; }` (one WeakSet add per whole read; measure `node --expose-gc libs/reactivity/bench/store.ts` before / after, ≤ noise). `server-resume.ts`:

```ts
// Captured stores (compiler C11: literal paths their captured code reads / writes): this render's marks.
const storeMarks = new WeakMap<object, { render: object; paths: readonly string[] }>();
export function _rStorePaths<S extends object>(store: S, paths: readonly string[]): S {
  const recorder = store$ ();
  return store;
}
```

— concretely:

```ts
export function _rStorePaths<S extends object>(target: S, paths: readonly string[]): S {
  const recorder = store.getStore() ?? unrecordedRender;
  if (recorder) storeMarks.set(target, { render: recorder.options, paths });
  return target;
}
// Pruned copy of `data`: containers along `paths` (shallow copies), leaf values by identity.
function prune(data: unknown, paths: readonly string[]): unknown {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    let from = data as Record<string, unknown>, to = out;
    const keys = path.split(".");
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      if (from === null || typeof from !== "object" || !Object.hasOwn(from, key)) break;
      if (i === keys.length - 1) to[key] = from[key];
      else {
        const next = from[key];
        if (next === null || typeof next !== "object") { to[key] = next; break; }
        to = (to[key] = Object.hasOwn(to, key) ? to[key] : Array.isArray(next) ? [] : {}) as Record<string, unknown>;
        from = next as Record<string, unknown>;
      }
    }
  }
  return out;
}
```

In `special` non-function branch (before `metaOf`): 

```ts
      const mark = storeMarks.get(value);
      if (mark !== undefined && mark.render === root.options) {
        const read = _storePaths(value as never);
        if (read !== null) {
          const { v, ...nodes } = value as { v: () => unknown };
          return { k: "store", a: [ref(prune(untrack(v), [...new Set([...read, ...mark.paths])])), ref(nodes)] };
        }
      }
```

(`root` = the `encoding(root)` parameter; import `_storePaths` from `@rivetjs/reactivity/store` — server-resume already depends on reactivity; check `scripts/zero-cost` keeps `store.ts` out of bundles that never import it: server-resume is server-only.) `dom-resume.ts` custom hook: `if (kind === "store") return { ...(args[1] as object), v: signal(args[0]) };` (the root signal is a fresh browser signal holding the pruned data; child nodes keep their decoded signals, which bindings armed on). `opaque` add `storeMarks.has(value) ||`.

- [ ] **Step 4: PASS; G-RX; G-RT; G-ZC (reactivity/store + runtime hash deltas: report); G-BYTES identical (nothing marks yet).**
- [ ] **Step 5: Docs + commit** (`libs/reactivity/CLAUDE.md` store gotcha + ABI; `docs/guides/stores.md` resume note; runtime docs `{k:"store"}`) `feat(runtime,reactivity): narrowed store captures (Function Bridge T12)`.

---

### Task T13: C11 — store literal paths (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-store.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` (`scan_call` :1746 inside captured closures), `libs/compiler/rust/src/compile.rs` (wrap the store declarator initializer, server target), `$S/patches/BRIDGE-T13.{patch,md}`

**Interfaces:**
- Consumes: T12 `_rStorePaths`.
- Produces: for a local `const s = createStore(…)` (`createStore` imported from `@rivetjs/reactivity/store`) captured by sites whose every use of `s` in captured closures is the first argument of `read` / `write` / `at` (same import) with a string-literal path (or `read(s, "a").x` member reads — path `a`), the server initializer becomes `__rivetR_storePaths(createStore(…), ["<paths sorted, deduped>"])`. Any other use → no wrapper (whole store) and nothing else (RV2104 warning comes from the language service, T20).

Expected emission:

```js
// narrow-store — server after
const store = __rivetR_storePaths(createStore({ count: 0, blob: "BIGDATA".repeat(50) }), ["count"]);
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-store.test.ts`:

```ts
// Function Bridge T13 (C11): literal store paths of captured code mark the store.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const server = (handler: string) =>
  (compile(
    `import { createStore, read, write } from "@rivetjs/reactivity/store";
export function Page() { const store = createStore({ count: 0, blob: "B" }); const key = "count";
  return <button onClick={() => ${handler}}>{read(store, "count")}</button>; }`,
    { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as { code: string }).code;

test("literal paths mark the store", () => {
  assert.match(server('write(store, "count", (c: number) => c + 1)'), /const store = __rivetR_storePaths\(createStore\(\{ count: 0, blob: "B" \}\), \["count"\]\)/);
});

test("a dynamic path keeps the whole store", () => {
  assert.doesNotMatch(server("write(store, key, (c: number) => c + 1)"), /__rivetR_storePaths/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch** (collect per store decl: `paths: BTreeSet<String>` and `dynamic: bool` while scanning captured closures' calls; at server emission of the declarator, wrap when `!dynamic && !paths.is_empty()`; register helper `storePaths` → `_rStorePaths`). `.md`: emission above; verify = flip `narrow-store`.
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip `narrow-store`; G-CORPUS; G-UI; G-ZC; G-BYTES.
- [ ] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md`; `test(compiler): store literal paths (Function Bridge T13)`.

---

### Task T14: Context id registry in reactivity; delete `resumableContext`

**Files:**
- Create: `libs/reactivity/tests/context-registry.test.ts`, `$S/bridge-plan/unwrap-resumable-context.mjs` (codemod, scratch)
- Modify: `libs/reactivity/index.ts` (`createContext` :1159, `_contextById`, `_placeholderContext`), `libs/reactivity/dev.ts` (façade keeps the same exports), `libs/runtime/resume-format.ts` (registry removed; re-export `_contextById` / `_placeholderContext` from reactivity; `resumableContext` deleted), every `resumableContext(` call site (169 files: `libs/cdk/**`, `libs/ui/**`, `libs/runtime/tests/**`, `libs/cdk/tests-components/**`, corpus case `context-in-binding`), `libs/runtime/dev/on.ts:16` message, `libs/reactivity/CLAUDE.md`, `libs/runtime/CLAUDE.md`, `libs/cdk/CLAUDE.md`, `libs/ui/CLAUDE.md`

**Interfaces:**
- Produces (reactivity ABI): `createContext(value, { id })` registers the token by id (an existing token with that id is returned; a resume placeholder adopts the default); `export const _contextById: (id: string) => Context<unknown> | undefined`; `export const _placeholderContext: (id: string) => Context<unknown>`.
- Removes: `resumableContext` (breaking; no alias).

- [ ] **Step 1: Failing test** `libs/reactivity/tests/context-registry.test.ts`:

```ts
// Function Bridge T14: every context with an id is resumable — registered by createContext itself.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createContext, _contextById, _placeholderContext } from "@rivetjs/reactivity";

test("createContext with an id registers the token", () => {
  const token = createContext("d", { id: "reg-a" });
  assert.equal(_contextById("reg-a"), token);
  assert.equal(createContext("other", { id: "reg-a" }), token);
});

test("a placeholder made before the module loaded is adopted with the real default", () => {
  const placeholder = _placeholderContext("reg-late");
  const token = createContext("late-default", { id: "reg-late" });
  assert.equal(token, placeholder);
  assert.equal(token.defaultValue, "late-default");
});

test("tokens without an id are not registered", () => {
  createContext("x");
  assert.equal(_contextById("undefined"), undefined);
});
```

- [ ] **Step 2: Run — expect FAIL** (`_contextById` not exported by reactivity).
- [ ] **Step 3: Implement** in `index.ts` (replace `createContext`):

```ts
// Identified tokens by id (Function Bridge T14: every context with an id resumes; `_contextById` / `_placeholderContext`
// are the resume ABI). A resumed re-creation may need a token before its module loaded: a placeholder, adopted here.
const contextIds = new Map<string, Context<unknown>>();
const placeholderIds = new Set<string>();
export function createContext<T>(defaultValue: T, options?: { id?: string }): Context<T> {
  if (options?.id === undefined) return Object.freeze({ defaultValue });
  const id = String(options.id),
    known = contextIds.get(id);
  if (known !== undefined) {
    if (placeholderIds.delete(id)) (known as { defaultValue: unknown }).defaultValue = defaultValue;
    return known as Context<T>;
  }
  const token = Object.freeze({ defaultValue, id });
  contextIds.set(id, token);
  return token;
}
/** Resume ABI: the registered token of `id`. */
export const _contextById = (id: string): Context<unknown> | undefined => contextIds.get(id);
/** Resume ABI: the token of `id`, or a placeholder the real `createContext` adopts (client re-creation before load). */
export const _placeholderContext = (id: string): Context<unknown> => {
  let token = contextIds.get(id);
  if (!token) {
    contextIds.set(id, (token = { defaultValue: undefined, id }));
    placeholderIds.add(id);
  }
  return token;
};
```

`dev.ts`: its wrapped `createContext` must call the base one (keeps registration); `tests/dev-facade.test.ts` export-set check passes. `resume-format.ts`: delete `tokens`, `placeholders`, `resumableContext`, local `_contextById` / `_placeholderContext`; add `export { _contextById, _placeholderContext } from "@rivetjs/reactivity";`.

- [ ] **Step 4: Codemod.** Write `$S/bridge-plan/unwrap-resumable-context.mjs`:

```js
// Unwrap resumableContext(createContext(...)) → createContext(...); drop the import. Prints files needing manual edits.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const files = execSync("git grep -l resumableContext -- 'libs/**/*.ts' 'libs/**/*.tsx' 'apps/**/*.ts' 'apps/**/*.tsx' 'templates/**/*.tsx'", { encoding: "utf8" }).trim().split("\n");
const manual = [];
for (const file of files) {
  let text = readFileSync(file, "utf8");
  const before = text;
  // resumableContext(createContext<…>(…)) — balanced parentheses scan from each call.
  for (let at = text.indexOf("resumableContext("); at !== -1; at = text.indexOf("resumableContext(", at)) {
    let depth = 0, end = at + "resumableContext".length;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    const inner = text.slice(at + "resumableContext(".length, end);
    if (!/^\s*createContext\b/.test(inner)) { manual.push(file); at = end; continue; }
    text = text.slice(0, at) + inner.trim() + text.slice(end + 1);
  }
  text = text.replace(/import \{ resumableContext \} from "@rivetjs\/runtime\/resume-format";\n/g, "")
    .replace(/(import \{[^}]*?)\bresumableContext,\s*/g, "$1").replace(/,\s*resumableContext\b/g, "");
  if (text !== before) writeFileSync(file, text);
  if (text.includes("resumableContext")) manual.push(file);
}
console.log([...new Set(manual)].join("\n"));
```

Run `node $S/bridge-plan/unwrap-resumable-context.mjs` (Edit-in-place rule: run it only on files with no other lane's uncommitted hunks — check `git diff --name-only` first and hand-edit those with Edit). Fix the printed files by hand (`resumableContext(X)` statements → delete; tests asserting `resumableContext` behaviour → assert `createContext` registration). `libs/runtime/dev/on.ts:16` text → "…captures a value provided through an identified context that did not serialize: provide data, or build it with reconstruct(() => …)".

- [ ] **Step 5: Run G-RX, G-RT, `bash $S/heavy.sh npx nx run-many -t typecheck --projects=cdk,ui,runtime,reactivity --output-style=static --skip-nx-cache`, G-UI, G-CORPUS (no change expected: `context-in-handler` still needs T15), G-ZC (reactivity / cdk / ui hash deltas: report), G-SIZE (createContext growth: report).**
- [ ] **Step 6: Docs.** `libs/reactivity/CLAUDE.md` (registry in createContext, ABI exports), `libs/runtime/CLAUDE.md` (Gotchas: region re-creation re-provides every id'd token), `libs/cdk/CLAUDE.md` + `libs/ui/CLAUDE.md` (rule "contexts need `{ id }`; no `resumableContext`").
- [ ] **Step 7: Commit** `feat(reactivity)!: identified contexts register themselves; resumableContext removed (Function Bridge T14)`.

---

### Task T15: Site frames (`cf`) + frame owners

**Files:**
- Create: `libs/runtime/tests/bridge-frames.test.ts`
- Modify: `libs/runtime/server-resume.ts` (Scope `frame`, `_rOn` / `_rBind` / `_rAttr` / `_rSpread` / `_rEffect` / `_rClientEvent` record `frameOf()`, `encodeRecords` writes `cf`), `libs/runtime/resume-format.ts` (`SiteFrames`, `ResumeRecords.cf`), `libs/runtime/dom-resume.ts` (owner per (region, list) for handlers / bindings / effects / client events; root owner under `cf.r`), `libs/runtime/tests/resume-owner-context-browser.test.ts` (remove its `test.fails` known limit — file is another lane's WIP: only if committed by then, else note it for T21)

**Interfaces:**
- Consumes: T14 (all id'd tokens registered).
- Produces: `ResumeRecords.cf?: SiteFrames`:

```ts
/**
 * Function Bridge frames: identified providers enclosing a site's creation (a table ref to a provider list
 * `[token id, value, …]`, outermost first — the RESUME-CTX list) when they differ from the site's region providers
 * (region entry [12]). `r`: the page-root list (root-region sites equal to it carry none). Segment-relative indexes.
 */
export interface SiteFrames {
  r?: number;
  /** Handlers: [element id, type key (with `!` for capture), list ref, …]. */
  e?: (number | string)[];
  /** Bindings: [index in this segment's `b` (wire, before unpacking), list ref, …]. */
  b?: number[];
  fx?: number[];
  ce?: number[];
}
```

- Browser: a handler dispatches, a binding / effect / client event runs under `frameOwner(region, list)` = cached `createRoot` child of `ownerOf(region)` providing the list (`within`-style nest) — region owners themselves are created under their [12] providers, the root owner under `cf.r`.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-frames.test.ts`:

```ts
// Function Bridge T15: sites record the identified providers they were created under (state `cf`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createContext, provide } from "@rivetjs/reactivity";
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";
import { readable } from "./resume/wire.ts";

const Name = createContext("default", { id: "bridge-frames-name" });
const manifest = { runtime: "/rt.js", symbols: { "t.tsx#T$a": "/c.js", "t.tsx#T$b": "/c.js" } };
const stateOf = (html: string) => readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as {
  t: unknown[];
  cf?: { r?: number; fx?: number[] };
};

test("an effect created under a provider records its provider list; the page root list covers root sites", async () => {
  const state = stateOf(
    (await resumableToString(() => {
      provide(Name, "server", () => _rEffect("t.tsx#T$a", []));
      _rEffect("t.tsx#T$b", []);
      return "x" as never;
    }, { manifest })) as string,
  );
  const lists = [state.cf?.r, ...(state.cf?.fx ?? []).filter((_, i) => i % 2 === 1)].filter((x) => x !== undefined) as number[];
  const decoded = lists.map((ref) => (state.t[ref] as number[]).map((i) => state.t[i]));
  assert.deepEqual(decoded, [["bridge-frames-name", "server"]]);
});

test("pages without providers carry no cf", async () => {
  const state = stateOf((await resumableToString(() => (_rEffect("t.tsx#T$b", []), "x" as never), { manifest })) as string);
  assert.equal(state.cf, undefined);
});
```

(The first test accepts either encoding — `cf.r` for the lone framed site, or a `cf.fx` pair — the implementation picks `r` = the most common list among root-region sites.)

- [ ] **Step 2: Run — expect FAIL** (`cf` undefined).
- [ ] **Step 3: Implement server.** `Scope` gains `frame: Frame | null` (set where scopes are created: `frameOf()`; root scope `null`). Record `frameOf()` with each handler (`element.handlers[key] = [id, captures, frameOf()]`), binding record, effect tuple (5th element), client-event tuple. In `encodeRecords`: `const listOf = (frame) => frame ? providersOf(frame) : null` (existing cache); per site `list !== listOf(regionScope.frame)` → candidate; root-region candidates: count lists, `r` = most frequent (ties: first); emit pairs for the rest; list refs interned through the existing `lists` WeakMap in `withProviders` (move it to encoder scope so computeds and sites share list entries). Only when any pair or `r` exists, `out.cf = { … }`. Packing (`packBindings`) groups only bindings with equal frame list (add it to the equality key); row templates require equal lists across rows (else `expand`).
- [ ] **Step 4: Implement browser** (`dom-resume.ts`): `const frameOwners = new Map<string, Owner | null>()` keyed `region + ":" + listRef`; `frameOwner(region, ref) = cached(runWithOwner(ownerOf(region), () => createRoot(() => nest(list))))` with `nest` = the `within` provider chain; `ownerOf(region)` for a region binding with [12] providers creates the region owner under them; `root` created under `cf.r`'s list when present (`start`). Handler dispatch: `_dispatch(ownerFor(entry), resumed, …)` / `batch(() => runWithOwner(ownerFor(entry), resumed))`; bindings / effects / client events: `runWithOwner(frameOwner(region, ref), …)` when a `cf` pair exists. Lookups: `cf.e` → `Map<elementId, Map<type, ref>>` built at `register`; `cf.b` / `fx` / `ce` → index maps per segment (streamed `patch()` segments carry their own `cf`).
- [ ] **Step 5: PASS; G-RT; G-CORPUS: flip `context-in-handler` + `context-in-binding` (`today: "pass"`); G-UI; G-ZC; G-SIZE (dom-resume delta: report; Phase 1 budget); G-BYTES (≤ +2% each page: if over, report the per-page `cf` bytes and stop).**
- [ ] **Step 6: Docs.** `libs/runtime/CLAUDE.md` (RESUME-CTX gotcha → frames for every site, `cf`), `libs/runtime/docs/resume.md` (`cf`), `docs/guides/resumability.md` "Contexts in the browser" limit removed (T21 sweeps the rest).
- [ ] **Step 7: Commit** `feat(runtime): resumed handlers / bindings / effects run under their server context frames (Function Bridge T15)`.

---

### Task T16: C10 — auto context ids (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-context-ids.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` / `libs/compiler/rust/src/compile.rs` (module-scope `createContext` calls, both targets), `$S/patches/BRIDGE-T16.{patch,md}`

**Interfaces:**
- Consumes: T14 registry, T15 frames.
- Produces: in a resume module, a module-scope `const X = createContext(v)` / `createContext(v, { …literal without id })` (`createContext` imported from `@rivetjs/reactivity`) compiles on **both** targets to `createContext(v, { id: "<module>#X$ctx" })` / `{ …, id: "<module>#X$ctx" }`; explicit ids, non-literal options, and non-module-scope calls are untouched. Non-resume modules: untouched (zero-cost).

Expected emission:

```js
// context-row — server + dom after
const Fmt = createContext((x) => x, { id: "src/context-row.tsx#Fmt$ctx" });
// context-in-handler (explicit id) unchanged: createContext("default", { id: "bridge-name" })
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-context-ids.test.ts`:

```ts
// Function Bridge T16 (C10): module-scope contexts of resume modules get content-stable ids on both targets.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const source = `import { createContext } from "@rivetjs/reactivity";
const Fmt = createContext<(x: string) => string>((x) => x);
const Theme = createContext("light", { id: "app-theme" });
const Size = createContext(1, {});
export function Page() { const Local = createContext(0); return <b>{String(Local.defaultValue)}</b>; }`;

for (const target of ["server", "dom"] as const)
  test(`${target}: auto ids for module-scope tokens only`, () => {
    const code = (compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string }).code;
    assert.match(code, /createContext\(\(x\) => x, \{ id: "src\/a\.tsx#Fmt\$ctx" \}\)/);
    assert.match(code, /createContext\("light", \{ id: "app-theme" \}\)/);
    assert.match(code, /createContext\(1, \{ id: "src\/a\.tsx#Size\$ctx" \}\)/);
    assert.match(code, /const Local = createContext\(0\)/);
  });

test("non-resume modules are untouched", () => {
  const code = (compile(source, { target: "dom", filename: "a.tsx" } as never) as { code: string }).code;
  assert.doesNotMatch(code, /\$ctx/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch** (detect `VariableDeclarator` at module scope with a `CallExpression` callee resolving to the `@rivetjs/reactivity` `createContext` import; emit the argument edit as a span replacement on both targets). `.md`: emission above; verify = flip `context-row`.
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip `context-row`; G-CORPUS; G-UI; G-ZC; G-BYTES.
- [ ] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md`; `test(compiler): auto context ids in resume modules (Function Bridge T16)`.

---

### Task T17: Drop `createResume({ contexts })`; `_rExtern`; router

**Files:**
- Create: `libs/runtime/tests/bridge-extern.test.ts`
- Modify: `libs/runtime/server-resume.ts` (delete `contexts` map / `_observeProvide` use / `{x}`; add `_rExtern`), `libs/runtime/resume-format.ts` (delete `x` entry + `context` hook; add `_externValue`, `{k:"ext"}` doc), `libs/runtime/dom-resume.ts` (`createResume()` without options; ext arming), `libs/compiler/vite.ts:771` (`createResume()`), `libs/router/build/codegen.ts` (:635–680 server entry, :849–852 resume entry), `libs/router/client/navigation.ts` / `client/search.ts` (comments), `libs/router/tests/codegen.test.ts`, `libs/runtime/dev/on.ts`, `apps/docs/content/guides/tooling/vite.md`, `apps/docs/content/reference/config.md`, `apps/docs/src/routes/(docs)/guides/tooling/vite.tsx` (regenerated by the docs build, do not hand-edit)

**Interfaces:**
- Produces (server-resume, internal): `export function _rExtern<T>(value: T, id: string): T` — value → id (WeakMap); encodes `{k: "ext", a: [idRef]}`.
- Produces (resume-format, internal): `export function _externValue(id: string, value: unknown): void` — browser registry; decode of `{k:"ext"}` returns it (missing → `Missing resume extern: <id>` error, dev hint); a decoded extern that is a signal arms the bindings that read it (as contexts did).
- Removes: `createResume({ contexts })` option, `{x}` entries, `DecoderHooks.context`.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-extern.test.ts`:

```ts
// Function Bridge T17: framework singletons (router navigation / search) resume by id; no createResume contexts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { _rExtern } from "@rivetjs/runtime/server-resume";
import { _externValue } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";

test("an extern encodes by id and decodes to the browser's registered value", async () => {
  const browserNav = signal("idle");
  _externValue("bridge:nav", browserNav);
  const { values, html } = await roundTrip(() => [{ nav: _rExtern(signal("server-only"), "bridge:nav") }], {}, {
    custom: (kind, args) => (kind === "ext" ? browserNav : undefined),
  });
  assert.doesNotMatch(html, /server-only/);
  assert.equal((values[0] as { nav: unknown }).nav, browserNav);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** server-resume:

```ts
// Framework singletons by id (router `Navigation` / `SearchParams` values; Function Bridge D9): the browser registers its
// own value under the same id (`_externValue`, generated resume entry). Internal ABI — apps use reconstruct(() => …).
const externs = new WeakMap<object, string>();
export function _rExtern<T>(value: T, id: string): T {
  if (Object(value) === value) externs.set(value as object, id);
  return value;
}
```

`special` first line: `const extern = externs.get(value); if (extern !== undefined) return { k: "ext", a: [ref(extern)] };`; `opaque`: `externs.has(value) ||`. Delete `root.contexts`, its `_observeProvide` registration and the `{x}` branch (`contexts.get(value)` lines in `special` and `opaque`), `providersOf`'s unregistered-token comment. resume-format: `const externValues = new Map<string, unknown>(); export function _externValue(id: string, value: unknown): void { externValues.set(id, value); } export const _extern = (id: string): unknown => { if (!externValues.has(id)) throw new Error("Missing resume extern: " + id); return externValues.get(id); };`, delete `x` (entry field, decoder branch, `context` hook). dom-resume: `export function createResume(): ResumeRuntime`; drop `byId`, the provider nest at `start` (root = `createRoot(getOwner)` under `cf.r` from T15), the `context` hook and the contexts arming loop; custom hook `if (kind === "ext") { const value = _extern(args[0] as string); ext.push([index?]) … }` — arm: after `register(state)`, scan `state.t` for compact `{k:["ext", idRef]}` entries whose value is a signal and `arm(ref, value)`.
- [ ] **Step 4: Router codegen.** Server entry: `<Provider token={Navigation} value={_rExtern(navigation, "rivet:navigation")}>` and `<Provider token={SearchParams} value={_rExtern(signal(input.url.searchParams), "rivet:search")}>` with `import { _rExtern } from "@rivetjs/runtime/server-resume";` only when resume is on (else unchanged output: zero-cost for non-resume router apps). Resume entry:

```ts
  const resumeEntry = [
    HEADER,
    `import { createResume } from "@rivetjs/runtime/dom-resume";`,
    ...(transitions || search ? [`import { _externValue } from "@rivetjs/runtime/resume-format";`] : []),
    ...(transitions ? [`import { navigation } from "@rivetjs/router/navigation";`, `_externValue("rivet:navigation", navigation);`] : []),
    ...(search ? [`import { searchParams } from "@rivetjs/router/search";`, `_externValue("rivet:search", searchParams);`] : []),
    "",
    `export default createResume();`,
    "",
  ].join("\n");
```

Update `libs/router/tests/codegen.test.ts` expectations (write them first: they fail, then pass). `vite.ts:771` → `export default createResume();`.
- [ ] **Step 5: Gates.** Ext test PASS; G-RT; `bash $S/heavy.sh npx vitest run --project router --maxWorkers=1`; router typecheck; G-UI; G-CORPUS; G-ZC (runtime / router hash deltas; non-resume router lanes identical); G-SIZE.
- [ ] **Step 6: Docs.** `apps/docs/content/guides/tooling/vite.md` + `reference/config.md`: `entry` = "module whose default export is `createResume()`"; app singletons → `reconstruct` (link T26 docs); `libs/router/CLAUDE.md` (extern ids); `libs/runtime/CLAUDE.md` entry table (`./dom-resume` → `createResume()`).
- [ ] **Step 7: Commit** `feat(runtime,router)!: createResume() without contexts; framework singletons by id (Function Bridge T17)`.

---

### Task T18: Q5 — recipe consts by value

**Files:**
- Create: `libs/runtime/tests/bridge-recipe-value.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`special` recipe-const branch :2330–2337)

**Interfaces:**
- Consumes: T2, T4 (inner functions stamped), T9.
- Produces: a recipe const (non-function value with a `_rFn` meta, not live / forward / accessor) encodes **by value** when `plain(value)` succeeds (every function inside is a Reference); else its recipe (today). A recipe id whose `plain` failed once is remembered (`recipeOnly` Set, like `unportable`), so failures cost one attempt per process.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-recipe-value.test.ts`:

```ts
// Function Bridge T18 (Q5): a recipe const whose value holds only References encodes by value (initializer runs once).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rFn } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

test("an array of symbols is data, not its recipe", async () => {
  let inits = 0;
  const { state, values } = await roundTrip(
    () => {
      const inner = _rFn("m.tsx#P$inc", () => 1, []);
      return [_rFn("m.tsx#P$fns", [inner], [])];
    },
    { "m.tsx#P$inc": () => () => "inc", "m.tsx#P$fns": () => (inits++, ["recipe"]) },
  );
  assert.equal(inits, 0);
  assert.ok(!state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#P$fns"));
  assert.equal((values[0] as [() => string])[0](), "inc");
});

test("a recipe const holding an unstamped function keeps its recipe", async () => {
  const { state } = await roundTrip(() => [_rFn("m.tsx#P$opaque", [() => 2], [])], { "m.tsx#P$opaque": () => ["r"] });
  assert.ok(state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#P$opaque"));
});
```

- [ ] **Step 2: Run — expect FAIL** (first test: the recipe entry is emitted).
- [ ] **Step 3: Implement** — in `special`, replace the tail of the non-function branch:

```ts
      if (holdsSignal(value, new Set())) {
        const entry = plain(value);
        if (entry !== undefined) return entry;
      }
      return { f: meta.id, a: meta.captures.map(ref) };
```

with

```ts
      // Q5 (Function Bridge T18): by value when everything in it encodes (functions are References) — the browser does not
      // re-run the initializer (side effects once). A recipe whose value failed once goes straight to its recipe.
      if (!recipeOnly.has(meta.id)) {
        const entry = plain(value);
        if (entry !== undefined) return entry;
        recipeOnly.add(meta.id);
      }
      return { f: meta.id, a: capturesOf(meta).map(ref) };
```

with `const recipeOnly = new Set<string>();` next to `unportable` (the `holdsSignal` pre-check is subsumed: a signal-holding value that encodes goes by value as before).
- [ ] **Step 4: PASS; G-RT; G-CORPUS: flip `recipe-side-effect`; `array-fn`, `map-fn`, `library-closure`, `factory-*` stay green; G-UI; G-ZC; G-BYTES + encode A/B (by-value may grow or shrink states: report per page; ≤ +2%).**
- [ ] **Step 5: Docs + commit** (`libs/runtime/CLAUDE.md` gotcha "Some documented failures already work…" → Q5 rule) `feat(runtime): recipe consts of References encode by value (Function Bridge T18, Q5)`.

---

### Task T19: Dev capture names (Q6) + index-free prod messages

**Files:**
- Create: `libs/runtime/tests/bridge-names.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`ResumeManifest.captures`, `refsOf` :2418, row `refs` :2511, packed :2791), `libs/compiler/vite.ts` (`devResume.manifest()` :394 adds `captures`), `libs/runtime/tests/function-bridge-corpus-browser.test.ts` (manifest `captures`), `libs/compiler/CLAUDE.md` (Vite plugin rules)

**Interfaces:**
- Produces: `ResumeManifest.captures?: Record<string, readonly string[]>` (symbol id → capture names; dev manifests only — `vite.ts` dev server; production `.vite/rivet-resume.json` never has it). Messages: dev `Cannot resume <id>: capture \`<name>\` <error>` (falls back to `#<i>` without names); prod `Cannot resume <id>: <error>`.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-names.test.ts`:

```ts
// Function Bridge T19 (Q6): render-time capture errors name the capture in dev (manifest names), no index in prod.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";

const DEV_RUN = process.execArgv.includes("--conditions=development");
const manifest = { runtime: "/rt.js", symbols: { "t.tsx#T$fx": "/c.js" }, captures: { "t.tsx#T$fx": ["count", "token"] } };

test("an unserializable capture is named by the dev manifest", async () => {
  await assert.rejects(
    async () => resumableToString(() => (_rEffect("t.tsx#T$fx", [1, Symbol("x")]), "x" as never), { manifest }),
    (error: Error) => {
      assert.match(error.message, /^Cannot resume t\.tsx#T\$fx: /);
      if (DEV_RUN) assert.match(error.message, /capture `token`/);
      else assert.doesNotMatch(error.message, /capture #|`token`/);
      return true;
    },
  );
});
```

- [ ] **Step 2: Run — expect FAIL** (both projects: today `capture #1`).
- [ ] **Step 3: Implement.** `ResumeManifest` gains `/** Dev only: capture names per symbol id (compiler dev server). */ captures?: Record<string, readonly string[]>;`. Replace the three message sites with one module function:

```ts
// "Cannot resume <id>: …" — dev names the capture (dev manifest, Q6), prod carries no index.
function captureError(manifest: { captures?: Record<string, readonly string[]> } | undefined, id: string, i: number, error: unknown): TypeError {
  const message = (error as Error)?.message ?? String(error);
  if (!DEV) return new TypeError("Cannot resume " + id + ": " + message, { cause: error });
  const name = manifest?.captures?.[id]?.[i];
  return new TypeError("Cannot resume " + id + ": capture " + (name ? "`" + name + "`" : "#" + i) + " " + message, { cause: error });
}
```

(`refsOf` gains the manifest parameter; callers pass `root.options.manifest`.) `vite.ts` `devResume.manifest()`: add `captures: new Proxy({} as Record<string, string[]>, { get: (_, id) => (typeof id === "string" ? devSymbols.get(id)?.symbol.captures : undefined) })`. Corpus runner manifest: `captures: Object.fromEntries(server.symbols.map((s) => [s.id, s.captures]))`.
- [ ] **Step 4: PASS both projects; G-RT; `bash $S/heavy.sh npx vitest run --project compiler libs/compiler/tests/vite-resume.test.ts --maxWorkers=1`; G-CORPUS (notes still match: they pin fragments without `#i`; fix any that pinned `capture #`); G-ZC (dev-leak scan: the names path is DEV-guarded).**
- [ ] **Step 5: Docs + commit** (`docs/guides/resumability.md` Limits "Capture errors name the capture index" → names in dev) `feat(runtime,compiler): dev capture names in resume errors (Function Bridge T19, Q6)`.

---

### Task T20: C13a — diagnostics RV2103 / RV2105 / RV2106 (patch) + RV2104 (language service)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-diagnostics.test.ts`
- Patch: `libs/compiler/rust/src/resume.rs` (capture classification), `libs/compiler/rust/src/diagnostics.rs` (codes), `$S/patches/BRIDGE-T20.{patch,md}`
- Modify (TS): `libs/compiler/codes.json` (RV2103 / RV2105 / RV2106 error, RV2104 warning "language service"), `libs/language-core/serializable.ts` (RV2104), `libs/language-core/explain.json` (4 entries), `libs/language-core/tests/serializable.test.ts`, `apps/docs/content/guides/tooling/language-service.md`

**Interfaces:**
- Produces messages (each with the capture site's and the declaration's spans):
  - RV2103 `Cannot resume \`<path>\`: function from <pkg> stored in <container>; capture the import directly or use reconstruct(() => …)` — a computed member of an import (`ns[key]`) in a captured container literal.
  - RV2104 (warning, language-core) `Cannot narrow \`<store>\`: dynamic store path; the whole store is serialized`.
  - RV2105 `Cannot resume \`<name>\`: <Symbol|WeakMap|WeakSet|WeakRef|Promise|FinalizationRegistry> is not serializable; create it inside the handler or use reconstruct(() => …)` — captured local initialized by `Symbol(…)`, `new WeakMap/WeakSet/WeakRef/Promise/FinalizationRegistry(…)`, `Promise.resolve/reject/all/allSettled/any/race(…)`.
  - RV2106 `Cannot resume \`this\` outside an object literal method; capture the object instead` — `this` in a captured closure (definite and R2 sites) that is not an object-literal method / class body.

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-diagnostics.test.ts`:

```ts
// Function Bridge T20 (C13a): named resume diagnostics RV2103 / RV2105 / RV2106.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const diags = (setup: string, call: string, prelude = "") =>
  (compile(
    `import { signal } from "@rivetjs/reactivity";
${prelude}
export function Page() { const n = signal(0); ${setup} return <button onClick={() => ${call}}>{n()}</button>; }`,
    { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as { diagnostics: { code: string; message: string; line?: number }[] }).diagnostics;

test("RV2105: WeakMap / Symbol / Promise captures", () => {
  for (const [init, kind] of [["new WeakMap()", "WeakMap"], ['Symbol("k")', "Symbol"], ["Promise.resolve(1)", "Promise"]]) {
    const [d] = diags(`const v = ${init};`, "n.set(v ? 1 : 0)");
    assert.equal(d?.code, "RV2105");
    assert.match(d!.message, new RegExp("Cannot resume `v`: " + kind + " is not serializable"));
    assert.ok(d!.line! > 0);
  }
});

test("RV2103: computed member of an import in a captured container", () => {
  const [d] = diags('const k = "double"; const opts = { f: u[k] };', "n.set(opts.f(1))", 'import * as u from "fake-util";');
  assert.equal(d?.code, "RV2103");
  assert.match(d!.message, /Cannot resume `opts\.f`: function from fake-util stored in an object/);
});

test("RV2106: this in a captured arrow outside a method", () => {
  const [d] = diags("", "n.set((this as unknown as { x: number }).x)");
  assert.equal(d?.code, "RV2106");
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch** (classification in the captures loop next to the C1 `new` check; existing `this` diagnostic gets the RV2106 text + code; codes in `diagnostics.rs`). TS side in the same commit after the wasm: `codes.json` entries (`"RV2103": error "Package function stored in a captured container"`, `"RV2104": warning "Dynamic store path (language service)"`, `"RV2105": error "Unserializable built-in captured"`, `"RV2106": error "this outside an object literal method"`), `explain.json` (messages / fix / avoid / prefer — `prefer` snippets must compile clean on both targets; run `npx vitest run --project language-core libs/language-core/tests/explain.test.ts`), RV2104 in `serializable.ts`: for a captured binding whose type is a store (`createStore` return type symbol `Store`), a `read|write|at(binding, <non-literal>)` call inside a site range → warning.
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; `bash $S/heavy.sh npx vitest run --project language-core --project mcp --maxWorkers=1`; `node libs/mcp/build-data.ts --check` (regenerate without `--check` first); G-CORPUS (no case should start failing compile).
- [ ] **Step 6: Docs + commit** (`apps/docs/content/guides/tooling/language-service.md` code list; `libs/language-core/CLAUDE.md`) `feat(compiler,language-core): named resume diagnostics RV2103–RV2106 (Function Bridge T20)`.

---

### Task T21: Phase 1 close — perf gates + docs-follow-code

**Files:**
- Modify: `docs/guides/resumability.md` ("Resumable functions (R2)" Not covered list, "Diagnostics: R2 sites are opportunistic", Limits "Capture errors name the capture index" / "Contexts in the browser"), `apps/docs/content/learn/resuming.md` ("Cannot be captured" column → only Symbol / WeakMap / Promise / resource classes without `revive` — Phase 2 adds the class rows), `apps/docs/content/gotchas/function-is-not-serializable.md`, `apps/docs/content/best-practices/serializable-captures.md`, root `CLAUDE.md` Rules "Resumability" bullet, `libs/runtime/CLAUDE.md` gotchas ("Module-level / imported functions…", RESUME-CTX "Not done for … handlers"), `libs/compiler/CLAUDE.md` R2 notes, `libs/mcp/ai/{agents.md,CLAUDE.md,digest.md,skills/fix-resumability-error.md}`, then generated `templates/*/{CLAUDE,AGENTS}.md` + plugin files, llms outputs, MCP data, `docs/design/specs/2026-10-09-function-bridge-design.md` status line, `libs/runtime/docs/resume.md`

- [ ] **Step 1: Grep for stale rules:** `git grep -n -e "resumableContext" -e "createResume({ contexts" -e "capture #" -e "stored in an object" -e "Not covered" -e "module-level functions resume when called" -- '*.md' '*.ts' '*.tsx' ':!docs/blog/**'` → every hit outside history (`docs/benchmarks`, dated specs) is rewritten to the bridge rules: functions anywhere resume (module refs, escape into captured holders, hoisting, `let` cells, `.bind`, mutual recursion); contexts resume by id (`createContext(v, { id })` in `.ts`, automatic in `.tsx`); named errors RV2103–RV2106; what still cannot be captured.
- [ ] **Step 2: Root `CLAUDE.md` Resumability bullet** — replace with: "Resumability: captured values resume with plain-JS semantics (functions anywhere, `let`, hoisting, `.bind`, contexts); what cannot is a named compile error (RV2102–RV2106) or a dev render error naming the capture; JSX content props are not serializable; resumable children of closed overlays / providers must be render-function children; `.ts` modules are not server-rewritten (contexts there need an explicit `{ id }`). See `docs/guides/resumability.md`."
- [ ] **Step 3: AI sources** — edit `libs/mcp/ai/*` the same way, run `node libs/mcp/ai/sync.ts`, then `node libs/mcp/ai/sync.ts --check`.
- [ ] **Step 4: Generated outputs** — `node libs/docs-kit/cli.ts llms docs` then `node libs/docs-kit/cli.ts llms docs --check`; same for `cdk-docs` / `ui-docs` if their content changed; `node libs/mcp/build-data.ts` then `--check`; `node libs/docs-kit/cli.ts check-content docs --strict`; `node libs/docs-kit/cli.ts check-snippets docs`; `bash $S/heavy.sh npx nx run docs:build --output-style=static`.
- [ ] **Step 5: Perf gates (spec §8)** — G-BYTES vs `$S/perf/BRIDGE-P1/baseline.txt` (≤ +2% br each page); ssr-bench `/resume` 0 / 1000 rows in-process encode A/B (≥ 5 interleaved rounds, load < 4) ≤ +2% CPU; resume-bench `--lanes rivet --conditions slow --repeats 10` interleaved with a HEAD-before-T2 build (click / keyClick / filter within noise; JS before interaction reported); G-SIZE (`/dom-resume` cumulative ≤ +600 B min; report); G-ZC final. Write the numbers into spec §8 as "8.2 Phase 1 result".
- [ ] **Step 6: Spec status line** → "Phase 0–1 done (…commits); Phase 2 in progress". Full gate run: `npm run typecheck`, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test --output-style=static --skip-nx-cache` (via heavy.sh), `npm run format:check`.
- [ ] **Step 7: Commit** `docs: Function Bridge phase 1 rules (Function Bridge T21)`.

---

### Task T23: Class registry runtime — `{cls}` two-phase entries

**Files:**
- Create: `libs/runtime/tests/bridge-classes.test.ts`
- Modify: `libs/runtime/server-resume.ts` (`_rClass`, encode in `special` before the encoder's "instance is not serializable" path, `wireSymbols` rewrites `cls`, `reachEntry` adds the class symbol), `libs/runtime/resume-format.ts` (`EntryRecord.cls` / `rv`, `DecoderHooks.cls`, decoder branch, `reachableSymbols`, `symbolOf`, `FIELDS` / `RESTORE` symbols), `libs/runtime/dom-resume.ts` (`cls` hook)

**Interfaces:**
- Produces: `export function _rClass(cls: abstract new (...a: never[]) => unknown, id: string): void` (server-resume; module load, compiler C12). An instance whose prototype chain (own `constructor`s, stopping at `Object.prototype`) holds a registered class encodes `{cls: id, a: [fieldsRef, privateRef?]}`: fields = own enumerable properties (recursive); private = `cls[Symbol.for("rivet.fields")](instance)` when the class defines it. Refused (unchanged error): `EventTarget` / `Node` / `AbortSignal` instances.
- Produces (resume-format): `export const FIELDS = Symbol.for("rivet.fields"), RESTORE = Symbol.for("rivet.restore");` — compiler-emitted static pair `static [FIELDS](o) { return [o.#a, …]; } static [RESTORE](o, d) { o.#a = d[0]; … }`.
- Decoder: `memo[index] = Object.create(Cls.prototype)` first, then own fields (`own()` per key), then `Cls[RESTORE](out, privates)`; the constructor never runs.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-classes.test.ts`:

```ts
// Function Bridge T23: registered data classes resume by prototype restore (no constructor), privates via the static pair.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rClass, _rFn } from "@rivetjs/runtime/server-resume";
import { FIELDS, RESTORE } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";

let constructed = 0;
class User {
  name: string;
  constructor(name: string) {
    constructed++;
    this.name = name;
  }
  initial() {
    return this.name[0]!.toUpperCase();
  }
}
class Money {
  #c: number;
  constructor(c: number) {
    this.#c = c;
  }
  cents() {
    return this.#c;
  }
  static [FIELDS](o: Money) {
    return [o.#c];
  }
  static [RESTORE](o: Money, d: [number]) {
    o.#c = d[0];
  }
}
class Counter {
  c = 1;
  inc = _rFn("m.tsx#Counter$inc", () => ++this.c, [this]);
}
_rClass(User, "m.tsx#User$class");
_rClass(Money, "m.tsx#Money$class");
_rClass(Counter, "m.tsx#Counter$class");
const classes = { "m.tsx#User$class": () => User, "m.tsx#Money$class": () => Money, "m.tsx#Counter$class": () => Counter };
const hooks = { cls: (id: unknown) => (classes as Record<string, () => unknown>)[id as string]!() };

test("instances keep their prototype and fields; the constructor does not run", async () => {
  const { values } = await roundTrip(() => [[new User("ada"), new User("bo")], new Money(250)], { ...classes }, hooks as never);
  constructed = 0;
  const [[a, b], money] = values as [[User, User], Money];
  assert.ok(a instanceof User);
  assert.equal(a.initial() + b.initial(), "AB");
  assert.equal(money.cents(), 250);
  assert.equal(constructed, 0);
});

test("a class-field arrow capturing `this` decodes through the two-phase entry", async () => {
  const { values } = await roundTrip(() => [new Counter()], { ...classes, "m.tsx#Counter$inc": (self: never) => () => ++(self as Counter).c }, hooks as never);
  const counter = values[0] as Counter;
  assert.equal(counter.inc(), 2);
  assert.equal(counter.c, 2);
});

test("DOM / EventTarget instances stay refused", async () => {
  class Bus extends EventTarget {}
  _rClass(Bus, "m.tsx#Bus$class");
  await assert.rejects(roundTrip(() => [new Bus()]), /not serializable/);
});
```

- [ ] **Step 2: Run — expect FAIL** (`_rClass` missing).
- [ ] **Step 3: Implement.** server-resume:

```ts
// Data classes (Function Bridge T23, compiler C12 registers every class a resume module declares or imports). The constructor
// symbol `<module>#<Class>$class` returns the class in the browser; instances restore their prototype, never re-construct.
const classIds = new WeakMap<object, string>();
export function _rClass(cls: abstract new (...a: never[]) => unknown, id: string): void {
  classIds.set(cls, id);
}
const refusedBase = (value: object): boolean =>
  (typeof EventTarget === "function" && value instanceof EventTarget) || (typeof AbortSignal === "function" && value instanceof AbortSignal);
function classOf(value: object): { id: string; cls: Record<symbol, unknown> } | undefined {
  for (let p = Object.getPrototypeOf(value); p !== null && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    const ctor = Object.hasOwn(p, "constructor") ? (p as { constructor: object }).constructor : undefined;
    const id = ctor && classIds.get(ctor);
    if (id) return { id, cls: ctor as Record<symbol, unknown> };
  }
  return undefined;
}
```

In `special` non-function branch, after the cell / store / extern checks and before `metaOf`:

```ts
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) {
        const known = classOf(value);
        if (known !== undefined && !refusedBase(value)) {
          const fields: Record<string, unknown> = {};
          for (const key of Object.keys(value)) fields[key] = (value as Record<string, unknown>)[key];
          const a = [ref(fields)];
          const read = known.cls[FIELDS] as ((o: object) => unknown[]) | undefined;
          if (read) a.push(ref(read(value)));
          return { cls: known.id, a };
        }
      }
```

`opaque`: `classOf(value) !== undefined ||`. `wireSymbols`: rewrite `cls` like `f` (index of the page symbol list); `reachEntry` / `reachableSymbols` / `symbolOf`: treat `entry.cls` as a symbol (`symbolOf(entry) = (entry.c ?? entry.f ?? entry.cls)`, and the `entry.a` branch condition `entry.c !== undefined || entry.f !== undefined || entry.cls !== undefined`). resume-format decoder, before `"k" in entry`:

```ts
    if ("cls" in entry) {
      const Cls = need("cls")(entry.cls as SymbolRef) as { prototype: object } & Record<symbol, unknown>;
      const out = (memo[index] = Object.create(Cls.prototype)) as Record<string, unknown>;
      const fields = get(entry.a![0]!) as Record<string, unknown>;
      for (const key of Object.keys(fields)) own(out, key, fields[key]);
      if (entry.a!.length > 1) (Cls[RESTORE] as (o: object, d: unknown) => void)(out, get(entry.a![1]!));
      return out;
    }
```

(`DecoderHooks.cls?: (symbol: SymbolRef) => unknown`; `EntryRecord.cls?: SymbolRef; rv?: 1`.) dom-resume hooks: `cls: (id) => symbol(id)()`.
- [ ] **Step 4: PASS; G-RT; G-ZC; G-SIZE; G-BYTES identical (nothing registers classes yet).**
- [ ] **Step 5: Docs + commit** (`docs/resume.md` `{cls}`; runtime CLAUDE.md "decoder BUSY rule: `cls` and `cell` decode two-phase — security note SEC10: their fields may cycle, reactive / function entries still may not") `feat(runtime): data class instances resume by prototype restore (Function Bridge T23)`.

---

### Task T24: C12 — `_rClass` registrations, private accessors, field arrows, RV2102 (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-classes.test.ts`
- Patch: `libs/compiler/rust/src/compile/resume_classes.rs` (new), `libs/compiler/rust/src/resume.rs` (lift "class instances are not serializable" for registered classes :2502; RV2102 eligibility), `libs/compiler/rust/src/compile.rs` (epilogue registrations, class body injection), `libs/compiler/rust/src/diagnostics.rs` (RV2102), `$S/patches/BRIDGE-T24.{patch,md}`
- Modify (TS): `libs/compiler/codes.json` (RV2102 error), `libs/language-core/explain.json` (RV2102)

**Interfaces:**
- Consumes: T23 `_rClass`, `FIELDS` / `RESTORE`; T25 exempts classes with `static [revive]` (the check reads the class body, so T24 can land first).
- Produces (server target of resume modules):
  - `__rivetR_class(<Cls>, "<module>#<Cls>$class");` at module end for each class **declared at module scope** or **statically imported** and used in a value / `new` position in a component; symbol `export const <Cls>$class = () => (<Cls>);` (kind `"class"`, imports / locals as refs).
  - In a declared class with `#private` fields: `static [Symbol.for("rivet.fields")](o) { return [o.#a, o.#b]; } static [Symbol.for("rivet.restore")](o, d) { o.#a = d[0]; o.#b = d[1]; }` appended to the class body (server + DOM: the browser needs `RESTORE`; DOM main module = the class's module).
  - Class-field arrows `inc = () => this.c.set(…)` → `inc = __rivetR_fn("<module>#<Cls>$<h>", () => this.c.set(…), [this])` (server); symbol `export const <Cls>$<h> = (__rivetSelf) => () => __rivetSelf.c.set(…);` (`this` → `__rivetSelf`).
  - `new Cls(…)` captured → no diagnostic when `Cls` is registered; RV2102 when the class body (constructor or field initializers) reads `window` / `document` / `navigator` / `globalThis` / `localStorage` / `sessionStorage` / `typeof window` / `new WebSocket|EventSource|Worker|BroadcastChannel` and has no `static [revive]`: `Cannot resume \`<capture>.<field>\`: <Cls> instance holds a resource (its field reads \`<global>\`); use reconstruct(() => new <Cls>(…)) or give <Cls> a static [revive]`.

Expected emission:

```js
// data-class — server after (module end)
__rivetR_class(ObjectId, "src/data-class.tsx#ObjectId$class");
// data-class-private — class body after: … cents() { return this.#c; }
//   static [Symbol.for("rivet.fields")](o) { return [o.#c]; } static [Symbol.for("rivet.restore")](o, d) { o.#c = d[0]; } }
// class-arrow-field — server after: inc = __rivetR_fn("src/class-arrow-field.tsx#Counter$h10", () => this.c.set(this.c() + 1), [this]);
// resource-class — diagnostic RV2102: Cannot resume `conn.live`: Conn instance holds a resource (its field reads `window`); …
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-classes.test.ts`:

```ts
// Function Bridge T24 (C12): data classes register; privates get the static pair; field arrows capture `this`; RV2102.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const run = (prelude: string, setup: string, target: "server" | "dom" = "server") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";
${prelude}
export function Page() { const n = signal(0); ${setup} return <button onClick={() => n.set(v ? 1 : 0)}>{n()}</button>; }`,
    { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as { code: string; diagnostics: { code: string; message: string }[]; symbols: { id: string; source: string }[] };

test("a captured data class instance registers its class", () => {
  const r = run("class User { name: string; constructor(n: string) { this.name = n; } }", 'const v = new User("ada");');
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivetR_class\(User, "src\/a\.tsx#User\$class"\);\s*$/);
});

test("private fields get the static accessor pair on both targets", () => {
  for (const target of ["server", "dom"] as const) {
    const code = run("class Money { #c: number; constructor(c: number) { this.#c = c; } }", "const v = new Money(1);", target).code.replace(/\s+/g, " ");
    assert.match(code, /static \[Symbol\.for\("rivet\.fields"\)\]\(o\) \{ return \[o\.#c\]; \} static \[Symbol\.for\("rivet\.restore"\)\]\(o, d\) \{ o\.#c = d\[0\]; \}/);
  }
});

test("class-field arrows capture this", () => {
  const r = run("class Counter { c = 0; inc = () => this.c++; }", "const v = new Counter();");
  assert.match(r.code, /inc = __rivetR_fn\("src\/a\.tsx#Counter\$[0-9a-z_]+", \(\) => this\.c\+\+, \[this\]\)/);
  const sym = run("class Counter { c = 0; inc = () => this.c++; }", "const v = new Counter();", "dom").symbols.find((s) => s.id.includes("#Counter$") && !s.id.endsWith("$class"))!;
  assert.match(sym.source, /\(__rivetSelf\) => \(\) => __rivetSelf\.c\+\+/);
});

test("RV2102: a class whose field reads window, without static [revive]", () => {
  const [d] = run('class Conn { live = typeof window !== "undefined"; }', "const conn = new Conn(); const v = conn;").diagnostics;
  assert.equal(d?.code, "RV2102");
  assert.match(d!.message, /Cannot resume `conn\.live`: Conn instance holds a resource/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch** (`resume_classes.rs`: `pub struct ClassPlan { registrations, private_pairs: Vec<(NodeId /*class body end*/, String)>, field_arrows: Vec<NodeId>, resources: Vec<(NodeId, String /*field*/, String /*global*/)> }`; field-arrow sites are `SiteKind::Fn` with `captures = ["this"]` emitted as `[this]` and symbol params `__rivetSelf` with `this` rewritten in the closure text). `.md`: emission above; verify = flip `class-store`, `class-arrow-field`, `data-class`, `data-class-private`, `data-class-nested`; `resource-class` reaches its `bridge` outcome (`today: "compile"`, `note` = the bridge message).
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip the five cases + set `resource-class` `today` / `note` to its bridge outcome; G-CORPUS; G-UI (cdk / ui classes now register: watch `CalendarDate`-style values — they now encode as `{cls}` instead of failing / being re-created; any behaviour change → report); G-ZC; G-BYTES (≤ +2%).
- [ ] **Step 6: Docs + commit** (`libs/compiler/CLAUDE.md`; `codes.json` + `explain.json` RV2102) `feat(compiler): resumable data classes + RV2102 (Function Bridge T24)`.

---

### Task T25: `serialize` / `revive` / `registerClass`

> As landed (2026-10-12): `registerClass(cls, { id, serialize?, revive })` — required string `id` (no `#`), wire `{cls: "<id>", a: [data], rv: 1}` (string `cls` = registered id, number = page symbol index), registry `Symbol.for("rivet.classes")`; the `rv` decoder lives in `resume-builtins.ts` (core: BUSY guard only); compiler registers `Verdict::Revive` classes (one-line `classes.rs` change). Test helper hooks: class symbols through `fn` (no `cls` hook). See spec §Data classes "As landed (T25)".

**Files:**
- Create: `libs/runtime/tests/bridge-revive.test.ts`
- Modify: `libs/runtime/resume-format.ts` (`serialize`, `revive`, `registerClass`, decoder `rv` path), `libs/runtime/server-resume.ts` (`special`: `[serialize]` / registered serializer → `{cls, a: [dataRef], rv: 1}`)

**Interfaces:**
- Produces (resume-format): `export const serialize: unique symbol` (= `Symbol.for("rivet.serialize")`), `export const revive: unique symbol` (= `Symbol.for("rivet.revive")`), `export function registerClass<T>(cls: abstract new (...a: never[]) => T, hooks: { serialize?(value: T): unknown; revive?(data: unknown): T }): void` — package classes whose privates are unreachable (bson `ObjectId`); call it in a module both the server entry and the resume entry import.
- Encoding: instance with `[serialize]()` (own method or registered hook) of a registered class → `{cls: id, a: [ref(data)], rv: 1}`; decode → `Cls[revive](data)` or the registered `revive(data)`, on first decode (lazy, as all entries).

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-revive.test.ts`:

```ts
// Function Bridge T25: resource holders rebuilt from their own data; package classes through registerClass.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rClass } from "@rivetjs/runtime/server-resume";
import { registerClass, revive, serialize } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";

class Conn {
  live = false;
  constructor(public url: string) {}
  [serialize]() {
    return { url: this.url };
  }
  static [revive](data: { url: string }) {
    const conn = new Conn(data.url);
    conn.live = true;
    return conn;
  }
}
class Opaque {
  #hex: string;
  constructor(hex: string) {
    this.#hex = hex;
  }
  hex() {
    return this.#hex;
  }
}
_rClass(Conn, "m.tsx#Conn$class");
_rClass(Opaque, "m.tsx#Opaque$class");
registerClass(Opaque, { serialize: (o) => o.hex(), revive: (hex) => new Opaque(hex as string) });
const classes: Record<string, unknown> = { "m.tsx#Conn$class": Conn, "m.tsx#Opaque$class": Opaque };

test("[serialize] / static [revive] rebuild the instance from its data", async () => {
  const { values, html } = await roundTrip(() => [new Conn("wss://x")], {}, { cls: (id) => classes[id as string] } as never);
  assert.doesNotMatch(html, /"live"/);
  const conn = values[0] as Conn;
  assert.ok(conn instanceof Conn);
  assert.equal(conn.url, "wss://x");
  assert.equal(conn.live, true);
});

test("registerClass serializes a package class without reachable privates", async () => {
  const { values } = await roundTrip(() => [new Opaque("65f0")], {}, { cls: (id) => classes[id as string] } as never);
  assert.equal((values[0] as Opaque).hex(), "65f0");
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** resume-format:

```ts
/** Resource holders (Function Bridge T25): `[serialize]()` returns the instance's data, `static [revive](data)` rebuilds it. */
export const serialize: unique symbol = Symbol.for("rivet.serialize") as never;
export const revive: unique symbol = Symbol.for("rivet.revive") as never;
const hooksOf = new WeakMap<object, { serialize?(value: unknown): unknown; revive?(data: unknown): unknown }>();
/** Serialize / revive a class you cannot edit (package classes): call in a module the server and resume entries both import. */
export function registerClass<T>(cls: abstract new (...a: never[]) => T, hooks: { serialize?(value: T): unknown; revive?(data: unknown): T }): void {
  hooksOf.set(cls, hooks as never);
}
/** @internal server-resume: the instance's revive data, when its class has a serializer. */
export const _serialized = (cls: object, value: object): { data: unknown } | undefined => {
  const hook = hooksOf.get(cls)?.serialize;
  if (hook) return { data: hook(value) };
  const own = (value as Record<symbol, unknown>)[serialize];
  return typeof own === "function" ? { data: (own as () => unknown).call(value) } : undefined;
};
```

Decoder `cls` branch start: `if (entry.rv) { memo[index] = BUSY; try { const data = get(entry.a![0]!); const make = hooksOf.get(Cls)?.revive ?? (Cls[revive] as (d: unknown) => unknown).bind(Cls); return (memo[index] = make(data)); } catch (error) { delete memo[index]; throw error; } }`. server-resume `special` class branch: `const serialized = _serialized(known.cls, value); if (serialized) return { cls: known.id, a: [ref(serialized.data)], rv: 1 };` before the fields path.
- [ ] **Step 4: PASS; G-RT; G-CORPUS: flip `resource-revive` (needs T24's registration + RV2102 exemption); G-ZC; G-SIZE.**
- [ ] **Step 5: Docs + commit** (`apps/docs/content/learn/resuming.md` resource holders section; runtime CLAUDE.md entry table `./resume-format` exports) `feat(runtime): serialize / revive / registerClass (Function Bridge T25)`.

---

### Task T26: `reconstruct` runtime + library-object hint

**Files:**
- Create: `libs/runtime/tests/bridge-reconstruct.test.ts`
- Modify: `libs/runtime/dom.ts` (+ `libs/runtime/dev/dom.ts` façade export), `libs/runtime/server.ts`, `libs/runtime/resume-format.ts` (function error message), `libs/runtime/CLAUDE.md`

**Interfaces:**
- Produces: `export function reconstruct<T>(factory: () => T): () => T` from `@rivetjs/runtime/dom` (browser) and `@rivetjs/runtime/server` (twin) = `computed(factory, { equals: false })`: lazy, reactive (a factory reading signals re-runs; `onCleanup` inside it disposes the previous value). Resume builds lower it to a computed site (T27): the server never encodes the value, the browser runs the factory on first read under the recorded frame.
- Produces: encoder message for an unstamped function `"function is not serializable (a library object holding functions: build it with reconstruct(() => …))"`.

- [ ] **Step 1: Failing test** `libs/runtime/tests/bridge-reconstruct.test.ts`:

```ts
// Function Bridge T26: reconstruct(() => value) — lazy, reactive, cleaned up on re-run.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, onCleanup, signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
import { reconstruct as serverReconstruct } from "@rivetjs/runtime/server";
import { createEncoder } from "@rivetjs/runtime/resume-format";

test("the factory runs on first read, re-runs on a signal change and cleans up", () => {
  const url = signal("a");
  const log: string[] = [];
  createRoot(() => {
    const conn = reconstruct(() => {
      const u = url();
      log.push("open " + u);
      onCleanup(() => log.push("close " + u));
      return { u };
    });
    assert.deepEqual(log, []);
    assert.equal(conn().u, "a");
    url.set("b");
    assert.equal(conn().u, "b");
  });
  assert.deepEqual(log, ["open a", "close a", "open b"]);
  assert.equal(serverReconstruct(() => 3)(), 3);
});

test("an unstamped function's error suggests reconstruct", () => {
  assert.throws(() => createEncoder().ref({ size: () => 1 }), /function is not serializable.*reconstruct\(/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** (`dom.ts` and `server.ts`, same body; `import { computed } from "@rivetjs/reactivity"` is already present in both — verify):

```ts
/**
 * A value built where it is used: lazy (first read), reactive (a factory reading signals re-runs; `onCleanup` inside it
 * disposes the previous value). On a resumed page the factory runs in the browser on first read, under the server's
 * context providers — for resource holders (sockets, library objects) that must not be serialized. Not `clientOnly`.
 */
export function reconstruct<T>(factory: () => T): () => T {
  return computed(factory, { equals: false });
}
```

`resume-format.ts`: the encoder's function refusal message → `"function is not serializable (a library object holding functions: build it with reconstruct(() => …))"` (keep the "function is not serializable" prefix: corpus notes / gotcha docs match on it). `dev/dom.ts` façade re-exports it (`tests/dev-facade`-style export parity test for runtime dom, if present, passes).
- [ ] **Step 4: PASS; G-RT; G-CORPUS: `library-object` reaches its bridge outcome (`today: "render"`, `note` = bridge message); G-ZC (dom / server hash deltas: report); G-SIZE.**
- [ ] **Step 5: Docs + commit** (`libs/runtime/CLAUDE.md` `./dom` + `./server` entries; `apps/docs/content/learn/resuming.md` "reconstruct" section + app singletons replacing `createResume({ contexts })`) `feat(runtime): reconstruct(() => value) (Function Bridge T26, Q3)`.

---

### Task T27: C14 — `reconstruct` sites (patch)

**Files:**
- Create: `libs/compiler/tests/resume-bridge-reconstruct.test.ts`
- Patch: `libs/compiler/rust/src/compile.rs` (`TARGET_HELPERS` :46 + `reconstruct`), `libs/compiler/rust/src/resume.rs` (site scan: `reconstruct` imported from `@rivetjs/runtime/dom|server` = `SiteKind::Computed` with implicit `{ equals: false }`), `$S/patches/BRIDGE-T27.{patch,md}`

**Interfaces:**
- Consumes: T26 `reconstruct`.
- Produces: resume server target `reconstruct(() => new Conn(url))` → `__rivetR_computed("<id>", () => new Conn(url), [url], { equals: false })`; plain server target imports it from `@rivetjs/runtime/server`; DOM main module keeps `reconstruct(…)` from `@rivetjs/runtime/dom`; symbol `export const <Name> = (url) => () => new Conn(url);`.

Expected emission:

```js
// resource-reconstruct — server after
const conn = __rivetR_computed("src/resource-reconstruct.tsx#Page$h11", () => new Conn("wss://x"), [], { equals: false });
// library-object-reconstruct — server after
const chart = __rivetR_computed("src/library-object-reconstruct.tsx#Page$h12", () => createChart(4), [], { equals: false });
```

- [ ] **Step 1: Failing test** `libs/compiler/tests/resume-bridge-reconstruct.test.ts`:

```ts
// Function Bridge T27 (C14): reconstruct(() => …) is a computed site with equals: false.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const source = `import { signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
export function Page() { const n = signal(0); const url = "wss://x"; const conn = reconstruct(() => ({ url }));
  return <button onClick={() => n.set(conn().url.length)}>{n()}</button>; }`;

test("resume server: a computed site with equals false", () => {
  const code = (compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string }).code;
  assert.match(code, /const conn = __rivetR_computed\("src\/a\.tsx#Page\$[0-9a-z_]+", \(\) => \(\{ url \}\), \[url\], \{ equals: false \}\)/);
});

test("plain server imports the twin; DOM keeps the call", () => {
  assert.match((compile(source, { target: "server", filename: "a.tsx" } as never) as { code: string }).code, /from "@rivetjs\/runtime\/server"/);
  assert.match((compile(source, { target: "dom", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string }).code, /reconstruct\(\(\) => \(\{ url \}\)\)/);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Write the patch.** `.md`: emission above; verify = flip `resource-reconstruct`, `library-object-reconstruct`.
- [ ] **Step 4: Hand off.**
- [ ] **Step 5: After the wasm:** test PASS; G-CMP; flip both; G-CORPUS; G-UI; G-ZC; G-BYTES.
- [ ] **Step 6: Docs + commit** `libs/compiler/CLAUDE.md`; `test(compiler): reconstruct sites (Function Bridge T27)`.

---

### Task T28: RV2102 / RV2105 quick fixes + explain entries

**Files:**
- Modify: `libs/language-core/fixes.ts` (`FIXABLE_CODES` + cases), `libs/language-core/explain.json` (`quickFix` for RV2102 / RV2105), `libs/language-core/tests/fixes.test.ts`, `libs/language-core/CLAUDE.md`

**Interfaces:**
- Produces: `codeFixes` for `RV2102` / `RV2105`: fix `rivetReconstruct` "Build it in the browser: reconstruct(() => …)" — wraps the captured declaration's initializer `X` as `reconstruct(() => X)`, adds `import { reconstruct } from "@rivetjs/runtime/dom"`, and rewrites the captured reads of the binding inside resume sites to calls (`conn.` → `conn().`).

- [ ] **Step 1: Failing test** (append to `libs/language-core/tests/fixes.test.ts`, using its existing `fixesFor(source, code)` helper — read the file first and use its exact helper name):

```ts
test("RV2105 / RV2102: wrap the captured initializer in reconstruct", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); const m = new WeakMap(); return <button onClick={() => n.set(m.has(n) ? 1 : 0)}>{n()}</button>; }`;
  const [fix] = fixesFor(source, "RV2105");
  assert.equal(fix?.fixName, "rivetReconstruct");
  const out = applyEdits(source, fix!.edits);
  assert.match(out, /import \{ reconstruct \} from "@rivetjs\/runtime\/dom";/);
  assert.match(out, /const m = reconstruct\(\(\) => new WeakMap\(\)\);/);
  assert.match(out, /m\(\)\.has\(n\)/);
});
```

- [ ] **Step 2: Run — expect FAIL** `bash $S/heavy.sh npx vitest run --project language-core libs/language-core/tests/fixes.test.ts --maxWorkers=1`.
- [ ] **Step 3: Implement** the `case "RV2102": case "RV2105":` branch: find the `VariableDeclaration` of the diagnostic's binding (`nodeAt` + `ts.findAncestor(node, ts.isVariableDeclaration)` via the declaration span the diagnostic carries), edit initializer → `reconstruct(() => <init>)`, `addNamedImport(ts, file, "@rivetjs/runtime/dom", "reconstruct")`, and every identifier reference to the binding inside arrow functions → `<name>()`. Add both codes to `FIXABLE_CODES`; `explain.json` `quickFix: "rivetReconstruct"`.
- [ ] **Step 4: PASS; `bash $S/heavy.sh npx vitest run --project language-core --project mcp --project typescript-plugin --maxWorkers=1`; `node libs/mcp/build-data.ts` + `--check`.**
- [ ] **Step 5: Commit** `feat(language-core): reconstruct quick fix for RV2102 / RV2105 (Function Bridge T28)`.

---

### Task T29: Phase 2 close — perf gates + docs-follow-code

**Files:**
- Modify: `apps/docs/content/learn/resuming.md` ("Cannot be captured" → Symbol / WeakMap / Promise / resource classes without `revive`; sections: data classes (constructor does not re-run), `[serialize]` / `static [revive]`, `registerClass`, `reconstruct`), `apps/docs/content/gotchas/function-is-not-serializable.md`, `apps/docs/content/best-practices/serializable-captures.md`, `docs/guides/resumability.md` (classes, built-ins, reconstruct), `libs/mcp/ai/*` (+ `sync.ts`), llms outputs, MCP data, `libs/runtime/docs/resume.md`, spec status + "8.3 Phase 2 result", `libs/compiler/CLAUDE.md`, `libs/runtime/CLAUDE.md`

- [ ] **Step 1: Grep** `git grep -n -e "class instances are not serializable" -e "instance is not serializable" -e "noSerialize" -e "useVisibleTask" -- '*.md' ':!docs/blog/**' ':!docs/benchmarks/**'` → rewrite each current-behaviour description.
- [ ] **Step 2: AI + generated outputs** — `node libs/mcp/ai/sync.ts` + `--check`; `node libs/docs-kit/cli.ts llms docs` + `--check`; `node libs/mcp/build-data.ts` + `--check`; `check-content docs --strict`; `check-snippets docs`; `bash $S/heavy.sh npx nx run docs:build --output-style=static`.
- [ ] **Step 3: Perf gates** — G-BYTES vs `$S/perf/BRIDGE-P1/baseline.txt`; encode A/B on showcases + ssr-bench `/resume`; resume-bench slow profile (interleaved, load < 4); G-SIZE; G-ZC; full typecheck + `nx run-many -t test` + `format:check` (via heavy.sh). Write the numbers as spec "8.3 Phase 2 result"; status → "Phases 0–2 done; Phase 3 (test helper + fuzz) not started".
- [ ] **Step 4: Commit** `docs: Function Bridge phase 2 rules (Function Bridge T29)`.


### Task T30: Phase 3a — `serializeAndRevive` + skew reload e2e + corpus flips

**Files:**
- Create: `libs/runtime/testing-resume.ts` (`@rivetjs/runtime/testing/resume`: `serializeAndRevive(make, { symbols?, platform?, contexts?, state? })`, `serializeValue`, `importResume(url, "server" | "browser")`), `libs/runtime/tests/serialize-and-revive.test.ts` + fixtures `tests/resume/serialize-fixture.tsx`, `serialize-private-fixture.tsx`, `serialize-plain.ts`, `libs/runtime/tests/resume-skew-browser.test.ts`, `apps/docs/content/guides/tooling/testing-resumability.md`
- Modify: `libs/runtime/testing-register.ts` (`?rivet-resume=server|dom|chunk`), `libs/runtime/package.json` (export), `libs/runtime/tests/resume/bridge-corpus.ts`, `apps/docs/content/_nav.ts`, `apps/docs/content/guides/tooling/testing.md`, `libs/runtime/CLAUDE.md`, `libs/runtime/tests/CLAUDE.md`, `libs/testing/CLAUDE.md`, spec §6 / §8.3 / §12, this plan

Rulings (coordinator, 2026-10-12): `make` runs inside the recorder (captures register only during a render), `serializeValue` for plain values; skew e2e file `tests/resume-skew-browser.test.ts` (runtime glob `tests/*.test.ts`); `platform` = opt-in browser globals for the decode only, restored after.

- [ ] **Step 1: Register resume mode** — `?rivet-resume=server|dom` compiles with `resume: { module: <cwd-relative> }`, carried to relative `.tsx` / `.jsx` imports; `chunk` = `_compileSymbolModule` of the module importing its `dom` compilation; server compiles record module id → URL + symbol captures.
- [ ] **Step 2: Helper** — encode through `resumableToString` + `_rEffect`, decode with dom-resume's hooks minus the document (same errors: dev hints, `error.skew`), browser half under its own `registerClass` registry, `platform` globals restored in `finally`.
- [ ] **Step 3: Tests** — primitives / built-ins, closures + `let` cell + signal, `_rMod`, `_rClass` / `static [revive]` / `registerClass`, narrowed store (`state` hook: unread field absent), `reconstruct`, cycle, platform; refusals vs a compiled page's render message (closure without a symbol, unregistered platform-based class, WeakMap, Promise; `#private` compile refusal; plain `.ts` closure); skew via `symbols`. Runtime + runtime-dev.
- [ ] **Step 4: Skew e2e** (Chromium, alone) — renumbered: right handler, no reload; changed: one `rivet:resume-error` `{skew}` (production message = the helper's), exactly one reload, no handler on the v1 document.
- [ ] **Step 5: Corpus** — flip every case Phases 1–2 made pass (`data-class-private` → `bridge` named error; add `data-class-private-revive`); list the remaining pins with their owning task (spec §8.3).
- [ ] **Step 6: Gates** — runtime / runtime-dev / compiler / language-core vitest (`--maxWorkers 1`, browser suites alone), oracle `compiler:parity`, typecheck runtime + testing + docs, docs content / snippets / llms / MCP data / `sync.ts --check`, zero-cost: the new `@rivetjs/runtime/testing/resume` line (report, no `--update`), size-report 0 B in `dom` / `dom-resume` / `server-resume`.
- [ ] **Step 7: Commit** `feat(runtime): serializeAndRevive test helper, skew reload e2e (Function Bridge T30)`.

### Task T31: Phase 3b — resume fuzz over the story apps

**Files:**
- Create: `libs/testing/fuzz/resume-fuzz.ts`, vitest Chromium projects `cdk-resume-fuzz` / `ui-resume-fuzz` (root `vitest.config.ts`, sharded per story app, `--maxWorkers 1`, never both at once), `$S/bridge/fuzz-findings.md` (unfixed findings)
- Modify: `docs/guides/resumability.md` ("Fuzz"), `libs/testing/CLAUDE.md`, root `CLAUDE.md` Gates, `.github/workflows/ci.yml` (separate sharded job), spec §8.3 / §12

- [x] **Step 1: Driver** — per story-app route (built `STORIES_DIST`, isolated per lane): load resumed (server HTML + resume) and CSR; discover interactive elements (a11y tree, `[data-rk]`, focusable scan); per element click, type a fixed string into text inputs, press the component's `navigationKeys` / `data-rk` keys; deterministic order + seed; `RIVET_FUZZ_ROUTES=` filter, `RIVET_FUZZ_STEPS=` cap.
- [x] **Step 2: Oracle** — after each step compare normalised DOM text + attributes (ids, `aria-*` idrefs, generated keys) resumed vs CSR; fail on `rivet:resume-error`, a component run on the resumed page (runtime dev counter), or a mismatch; minimal repro log (route, selector, steps).
- [x] **Step 3: Triage** the first run — real bug: fix if ≤ 1 h and in bridge scope, else file with owner + `test.fails` pin; harness false positive: fix the normaliser. Budget ≤ 10 min per shard.
- [x] **Step 4: Docs + CI**, spec §8.3 results + §12 as landed.
- [x] **Step 5: Commit** `test(testing): resume fuzz over the story apps (Function Bridge T31)`.
- As landed (2026-10-12): driver + normaliser `libs/testing/fuzz/` (`@rivetjs/testing/fuzz`), projects `cdk-resume-fuzz` / `ui-resume-fuzz` (`libs/{cdk,ui}/tests-fuzz/`, pins in `pins.ts`), CI job `resume-fuzz` (app × 3 shards); component runs detected as re-created server nodes (stamps), not a dev counter; results + triage spec §8.5.

---

## Self-review (done while writing)

- Spec coverage: §3.1 ids → consumed (C2 lane) · §3.2 module refs T2/T3, imported functions T3, escape T4, hoisting T5/T6, groups T9/T10, `.bind` T9/T10, `this` methods unchanged (rule kept) · §3.3 late captures T5/T6, cells T7/T8, narrow paths T11, stores T12/T13 · §3.4 context ids T14/T16, frames T15, `createResume` contexts T17 (Q4) · §3.5 reach walks: every new entry kind (`cell`, `bind`, `gm`, `store`, `ext`, `cls`) goes through `entry.a` / explicit branches in T7 T9 T12 T17 T23; lazy-only reach unchanged (prod sync throw + dev warning are today's `symbol()` / T19 names) · §3.6 diagnostics T20 / T24 / T28 (codes renumbered, D7) · §3.7 ABI bump T2, format additions T7 T9 T12 T15 T17 T23 T25 · §4 built-ins C1 (other lane), data classes T23/T24, resource holders T25/T26/T27, library objects T26 (hint) + T27 · §7 migration T14 T17 T21 T29 · §8 gates per task + T21/T29 · §10 rulings: Q1 (no boot check: nothing added), Q2 T7, Q3 T26, Q4 T17, Q5 T18, Q6 T19.
- Not covered on purpose: §6 Phase 3 (separate plan); §3.5 dev warning "naming id + capture path + preload hint" for dynamic-only reach beyond T19's capture names — today's `symbol()` dev hint (`skew` / chunk not loaded) stays; add with Phase 3 fuzz if the fuzz finds such reach.
- Names used across tasks: `_rMod`, `_rFn(id, fn, captures | thunk, member?)`, `_rCell`, `_rBound`, `_rStorePaths`, `_storePaths`, `_rExtern` / `_externValue` / `_extern`, `_rClass`, `FIELDS` / `RESTORE`, `serialize` / `revive` / `registerClass` / `_serialized`, `reconstruct`, `SiteFrames` / `cf`, entry keys `cell` `bind` `gm` `store` `ext` `cls` `rv`, symbol ids `$ref` `$class` `$ctx`, codes RV2102–RV2106 — consistent in all tasks.
