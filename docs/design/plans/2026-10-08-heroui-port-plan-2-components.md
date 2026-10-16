# HeroUI port — Plan 2: infra prerequisites, cdk `render`, first component wave

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Plan 1 infra gaps that do not need live props (resume through `.ts` barrels, `ref` in spreads, accessor-typed `dom.*`, cdk `render` prop on every RAC part), then port the HeroUI components that work with keyed re-creation today (18 dirs). Components whose correctness needs reactive props are listed last and marked `BLOCKED-ON-LIVE-PROPS`.

**Architecture:** Same as Plan 1: `libs/ui/src/components/<name>/` mirrors HeroUI; plain-data contexts; module-level `slotsFor` memo; `dom.*` for plain elements; RAC parts → `@rivetjs/cdk/<name>`. cdk gets one shared `render` helper (`libs/cdk/utils/render.ts`) used by every part so the RAC idiom `render={(props, renderProps) => <a {...props} />}` works; `dom.*` switches from "ignore + dev warn" to calling it.

**Tech Stack:** Rivet (`@rivetjs/reactivity`, `runtime`, `cdk`, `kit/icon`), Rust/oxc compiler (root-only edits), tailwind-variants 3.3.1, Tailwind 4.3.3, Vitest (+ Chromium), Playwright.

**Spec:** `docs/design/specs/2026-10-07-heroui-port-design.md` (§2 translation, §3 cdk gaps). **Findings:** `docs/design/research/2026-10-07-heroui-port-spike.md` (§3 `render` shape, §6 prerequisites P1–P4). **Previous plan:** `2026-10-07-heroui-port-plan-1-foundation.md`. **Live props spec:** `docs/design/specs/2026-10-07-live-props-design.md`.

**Plan series (spec §5 lanes, revised):** Plan 1 foundation (done) → **Plan 2 (this): infra + cdk `render` + display/fields/button wave** → Plan 3 cdk structural gaps #2–#9 (composable Select, Tabs/Radio parts, hideable parts, behaviour holes) + parity harness `apps/ui-parity` → Plan 4 collections / overlays / date-color / remaining forms lanes → Plan 5 `apps/ui-docs`. Live-props-gated work (Tasks 19–23 here) runs whenever the live-props gate passes, in this plan or the next.

## Global Constraints

- Upstream: HeroUI v3.2.6 @ `73000ea`; clone `HEROUI=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad/heroui` (re-clone: `git clone https://github.com/heroui-inc/heroui "$HEROUI" && git -C "$HEROUI" checkout 73000ea`). Components: `$HEROUI/packages/react/src/components/<name>/`; upstream tests: `$HEROUI/packages/react/tests/components/<name>/` (125 files total).
- 1:1: exported names, props, defaults, `data-slot`, class strings = v3.2.6. `class` only (no `className`). Every user-visible diff → `libs/ui/CLAUDE.md` "Known diffs" (until Plan 3 `known.ts`).
- Plan 1 rulings that carry over (apply to every component task; full text `libs/ui/src/components/CLAUDE.md` "Port pattern"):
  1. Contexts carry PLAIN data (`{ variant, size, color }`), `resumableContext(createContext<X>({}, { id: "rv-ui-<name>" }))` + `<Provider token value>`; never accessors / tv slot functions. Context shapes differ from upstream `{ slots }` → Known diff row per component.
  2. Slots: module-level memo `slotsFor` (`SLOTS[key] ??= xVariants(...)`), key on defaulted values; parts outside a provider read `undefined` slots (= upstream `slots?.x`).
  3. Roots keep the generic `<E extends keyof JSX.IntrinsicElements = "…">` with props `XRootProps<E> & JSX.IntrinsicElements[E]` (no `Omit` of the generic indexed type: TS2590); body casts to the default-element type `XRootDivProps`; `index.ts` type maps use it.
  4. Provider-wrapping roots build content as a thunk (`const content = () => <…/>`) called inside the provider; every such part needs a DOM test reading the context (SSR tests do not catch it).
  5. Dev-only warnings through the package `#dev` import only (`dev-on.ts` / `dev-off.ts`); register the message text in `scripts/zero-cost/dev-leaks.mjs` `DEV_MESSAGES`.
  6. `@rivetjs/ui/<name>` subpath per component (`package.json` exports + `index.ts` barrel line + `tests/package.test.ts` mapping), file header `// Ported from HeroUI v3.2.6 …(Apache-2.0, © 2025 NextUI Inc.; modified).` + `Rivet:` deviation list on every file.
  7. Tests per component: `tests/<name>.server.test.tsx` (SSR via `index.ts`), `tests/<name>.test.tsx` (DOM, happy-dom via `tests/install-dom.ts`, incl. context reads), `tests/<name>.types.tsx` (`tsc -p libs/ui`), plus a story route + resume case in `tests-components/` for any provider-wrapping or dynamic-prop part. Upstream `tests/components/<name>/*.test.tsx` cases are ported (React Testing Library → `installDom()` + direct DOM asserts; a case needing real events goes to the Chromium suite); a skipped case is listed with the reason in the test file header.
  8. Zero-cost: component tasks do NOT touch `scripts/zero-cost/packages.txt`; Task 24 computes all new `libs/ui` rows once, on a clean HEAD copy (Ruling 8), never `--update` in the shared checkout.
  9. Icons: lucide via `@rivetjs/kit/icon` (`import { Icon } from "@rivetjs/kit/icon"`); never SVG paths, never UTF glyphs. Where upstream inlines an SVG, map to a lucide icon and add a Known diff.
- Props are snapshots until live props land: a component taking a changing prop (`isDisabled={s()}`) is re-created by a keyed `Show` in tests/docs. Do not implement per-component workarounds.
- Rust: only the root agent edits `libs/compiler/rust/**` and builds wasm. A task needing Rust writes `scratchpad/compile-rs-patches/<name>.patch.md` (unified diff against HEAD + what / why / verify steps) and messages the root agent; the dependent test is `test.fails` with the patch name in a comment until the wasm lands. Never `.rs` edits, never Docker.
- Every run: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH`, `NODE_OPTIONS=--max-old-space-size=3072`, vitest `--maxWorkers=2`, nx `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; Chromium `--use-mock-keychain --password-store=basic`.
- Git (main checkout `perf/ssr-beat-razor`, no worktrees, no push): pathspec commits only — `git add <new files>` then `git commit -m "…" -- <every path of this task>`; never bare `git commit`, never `-A` / `.`. Commit messages end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never touch user WIP (`apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `*-tmp.ts`, `docs/blog/**`).
- **Foreign-hunk files** (modified in the working tree by other lanes at plan time: `libs/runtime/dom-v2.ts`, `libs/runtime/dom-router.ts`, `libs/reactivity/index.ts`, `libs/reactivity/tests/dispatch-defer.test.ts`, `libs/router/client/index.ts`, `libs/runtime/tests/click-defer-browser.test.ts`, `docs/CLAUDE.md`, `apps/resume-bench/run.ts`): a pathspec commit would sweep their hunks. Recipe: before editing `cp <file> $S/<name>.pre` (`S` = scratchpad dir); after editing build a patch of only your change with `git diff --no-index --no-prefix $S/<name>.pre <file>` (rewrite the two header paths to `<file>` with sed), then `export GIT_INDEX_FILE=$S/idx; git read-tree HEAD; git apply --cached <patch>; git commit -m "…"; unset GIT_INDEX_FILE` (the temp index also takes the task's other paths via `git add`). Check `git diff HEAD --stat -- <file>` before touching any shared file.
- Every touched dir's CLAUDE.md is updated in the same commit (nearest CLAUDE.md; cdk modules each have one; root `CLAUDE.md` only for repo-map / gate changes).
- Gates per task: the task's own tests + `npx tsc -p libs/ui` (or the lib's typecheck) + `npx prettier --write <owned files that were clean at HEAD>`. Whole-plan gates in Task 24.

## Pre-flight: tasks sharing files

| File | Tasks (order = run order) | Finding / rule |
|---|---|---|
| `libs/compiler/vite.ts` | 1 | single writer; JS only |
| `libs/runtime/dom-v2-spread.ts`, `libs/runtime/dom-v2.ts` (foreign hunks) | 2 | temp-index recipe; Rust half → root queue |
| `libs/ui/src/utils/dom.tsx`, `dom-tags.tsx` | 3, 8 then every component task adding a tag | 3 types, 8 render, later tasks append one `export const <tag>` line each (serial) |
| `libs/cdk/utils/render.ts`, `libs/cdk/utils/index.ts` | 4 produces; 5–7 consume | 5–7 must start after 4 |
| `libs/cdk/<module>/index.tsx` + its `CLAUDE.md` | 4 (core 8), 5 (forms), 6 (collections/overlays), 7 (date/color/rest) | disjoint module lists (below) → 5, 6, 7 may run in parallel after 4 |
| `libs/cdk/CLAUDE.md`, `apps/cdk-docs` render page | 4 creates, 5–7 append one row each | append-only; serialize the row edits |
| `libs/ui/package.json` exports, `libs/ui/index.ts`, `tests/package.test.ts`, `src/components/CLAUDE.md`, `libs/ui/CLAUDE.md` | 10–18 (+ 19–23) | every component adds one line to each: run 10–18 serially (or merge lines by hand); no other task touches them |
| `libs/ui/src/utils/CLAUDE.md`, `index.ts` hooks | 9 then 11 (skeleton reads the hook) | serial |
| `libs/ui/tests-components/app/**` routes, `harness.ts` | 1 (import switch), 10–18, 19–23 | each component adds its own route file; `harness.ts` touched only by 1 |
| `scripts/zero-cost/dev-leaks.mjs` | 8, 11 (new `#dev` messages) | append-only |
| `scripts/zero-cost/packages.txt` | 24 only | Ruling 8 |
| `vitest.config.ts` | none (globs already cover `libs/ui/tests/*.test.{ts,tsx}`, `libs/cdk/tests/*.browser.test.tsx`) | no edit |

Task dependencies: 1, 2, 3, 4 independent; 5–7 need 4; 8 needs 2, 3, 4; 9 independent; 10–18 need 1, 3, 8 (and 4 for Button/Link/Separator/Header/Label/Text/Heading/Keyboard `render`), 14 needs 2 (ref in spread) only for its `render` test; 19–23 need the live-props gate (below); 24 needs everything it gates.

**Live-props gate (for BLOCKED tasks):** `libs/reactivity/tests/live-props*.test.ts` (the live-props lane's tests) pass on HEAD AND the lane's heap gate is recorded in `docs/benchmarks/`; check with `git log --oneline -20 -- docs/design/specs/2026-10-07-live-props-design.md libs/reactivity` and the spec's Status line. Until then these tasks are not started (no workaround code).

## File map

| Path | Responsibility |
|---|---|
| `libs/compiler/vite.ts`, `libs/compiler/tests/vite-ts-barrel.test.ts` | resume discovery follows `.ts` barrels of source packages |
| `libs/runtime/dom-v2-spread.ts`, `libs/runtime/tests/spread-ref.test.ts` | `ref` key inside `{...spread}` |
| `libs/ui/src/utils/dom.tsx`, `dom-tags.tsx`, `tests/dom.types.tsx` | accessor-typed `dom.*`, `render` applied |
| `libs/cdk/utils/render.ts`, `libs/cdk/<48 modules>/index.tsx`, `libs/cdk/tests/render-*.browser.test.tsx` | `render` prop |
| `libs/ui/src/hooks/use-css-variable.ts` | upstream hook ports (as needed) |
| `libs/ui/src/components/<name>/` ×18 | wave 1 components |
| `libs/ui/tests/*`, `libs/ui/tests-components/*` | per-component suites + story app routes |

---

## Phase A — infra that does not need live props

### Task 1: Resume discovery follows `.ts` barrels (Plan 1 open item a)

**Files:**
- Modify: `libs/compiler/vite.ts` (`isResumable` area, ~line 374; `sourcePackagesOf`)
- Create: `libs/compiler/tests/vite-ts-barrel.test.ts`
- Modify: `libs/ui/tests-components/app/routes/*` (the route importing `dom` from `src/utils/dom.tsx` → `@rivetjs/ui`), `libs/ui/tests-components/resume.test.ts`, `libs/ui/CLAUDE.md` (remove the "isResumable does not walk `.ts` barrels" gotcha), `libs/compiler/CLAUDE.md`

**Interfaces:**
- Consumes: `isResumable(filename)` (`/\.[jt]sx$/` + source package check), `sourcePackagesOf`, `importedSources` (vite.ts ~340-365).
- Produces: a resumed route that does `import { dom } from "@rivetjs/ui"` and records a `dom.*` symbol resumes (manifest has the chunk for `@rivetjs/ui/src/utils/dom-tags.tsx#div$n`).

- [ ] **Step 1: Locate the exact gap.** Read `libs/compiler/vite.ts` lines 300-400. The resume-symbol chunk graph is built from the `sourcePackages` each resumable module imports; `import { dom } from "@rivetjs/ui"` resolves to `libs/ui/index.ts` (`export *` chain through `src/utils/dom.tsx` → `export * as dom from "./dom-tags.tsx"`). `.ts` files are not resumable modules, so the `.tsx` leaf `dom-tags.tsx` is never registered. Fix = when resolving an import of a source package entry that is a `.ts`/`.js` file, follow its static `export … from` / `import … from` specifiers (relative, same package) recursively and add every `.tsx`/`.jsx` leaf to the resume module set.

- [ ] **Step 2: Write the failing test** `libs/compiler/tests/vite-ts-barrel.test.ts`

```ts
// Plan 2 Task 1: resumed modules importing a source package through a `.ts` barrel register the barrel's `.tsx` leaves.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { barrelLeaves } from "../vite.ts";

test("barrelLeaves: follows export-from chains through .ts files and returns .tsx leaves, sorted, once", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-barrel-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "index.ts"), `export * from "./src/a.ts";\nexport { b } from "./src/b.tsx";\n`);
  writeFileSync(join(dir, "src/a.ts"), `export * as dom from "./tags.tsx";\nexport * from "./a2.ts";\n`);
  writeFileSync(join(dir, "src/a2.ts"), `export * from "./a.ts"; // cycle\nexport const x = 1;\n`);
  writeFileSync(join(dir, "src/tags.tsx"), `export const div = () => null;\n`);
  writeFileSync(join(dir, "src/b.tsx"), `export const b = () => null;\n`);
  const leaves = barrelLeaves(join(dir, "index.ts")).map((f) => f.slice(dir.length + 1));
  assert.deepEqual(leaves, ["src/b.tsx", "src/tags.tsx"]);
});

test("barrelLeaves: a .tsx entry is its own leaf; missing/external specifiers are ignored", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-barrel-"));
  writeFileSync(join(dir, "e.tsx"), `export const e = 1;\n`);
  writeFileSync(join(dir, "f.ts"), `export * from "@rivetjs/runtime";\nexport * from "./missing.ts";\n`);
  assert.deepEqual(barrelLeaves(join(dir, "e.tsx")), [join(dir, "e.tsx")]);
  assert.deepEqual(barrelLeaves(join(dir, "f.ts")), []);
});
```

- [ ] **Step 3: Run to see it fail.** `npx vitest run libs/compiler/tests/vite-ts-barrel.test.ts --project compiler --maxWorkers=2` → FAIL (`barrelLeaves` is not exported).

- [ ] **Step 4: Implement.** In `libs/compiler/vite.ts` add (exported for the test, near `sourcePackagesOf`):

```ts
/** `.tsx`/`.jsx` leaves reachable from a source-package entry through relative `export … from` / `import … from` in `.ts`/`.js` barrels (cycle-safe, sorted). */
export function barrelLeaves(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry) || !existsSync(entry)) return [];
  seen.add(entry);
  if (/\.[jt]sx$/.test(entry)) return [entry];
  if (!/\.[cm]?[jt]s$/.test(entry)) return [];
  const out = new Set<string>();
  const source = readFileSync(entry, "utf8");
  for (const m of source.matchAll(/(?:export|import)\s[^;]*?from\s*["'](\.[^"']+)["']/g)) {
    for (const leaf of barrelLeaves(resolve(dirname(entry), m[1]!), seen)) out.add(leaf);
  }
  return [...out].sort();
}
```

Then in the code that walks a resumable module's imports of source packages (the `importedSources` loop ~346-366), after resolving a package entry `hit`, replace `found.add(hit)` with `for (const leaf of barrelLeaves(hit)) found.add(leaf); found.add(hit)` (keep `hit` so existing behaviour is unchanged). Imports already present in the file (`existsSync`, `readFileSync`, `resolve`, `dirname`) — add any missing to the node imports.

- [ ] **Step 5: Run** the test again → PASS. Then the end-to-end case: in the story app change the route that imports `dom` from `../../../src/utils/dom.tsx` to `import { dom } from "@rivetjs/ui"`, and in `resume.test.ts` keep the existing `<dom.div class={() => cls()}>` resume case (it must now pass through the barrel). Run `npx vitest run --project ui-components --maxWorkers=2` → PASS (previously "Resume manifest has no chunk for @rivetjs/ui/src/utils/dom-tags.tsx#div$n").

- [ ] **Step 6: Docs.** `libs/ui/CLAUDE.md`: delete the `.ts`-barrel gotcha, replace with one line "resume chunks follow `.ts` barrels of source packages (`barrelLeaves`, `libs/compiler/vite.ts`)". `libs/compiler/CLAUDE.md`: add `barrelLeaves` to the Vite plugin section.

- [ ] **Step 7: Gates + commit.** `npx vitest run --project compiler --maxWorkers=2`; `npx tsc -p libs/compiler`; prettier on the three TS files.

```bash
git add libs/compiler/tests/vite-ts-barrel.test.ts
git commit -m "fix(compiler): resume chunk discovery follows .ts barrels of source packages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- libs/compiler/vite.ts libs/compiler/tests/vite-ts-barrel.test.ts libs/compiler/CLAUDE.md libs/ui/CLAUDE.md libs/ui/tests-components
```

---

### Task 2: `ref` inside `{...spread}` (prerequisite P3)

**Files:**
- Modify: `libs/runtime/dom-v2-spread.ts` (foreign-hunk neighbour `dom-v2.ts`: do not edit it unless unavoidable → temp-index recipe), `libs/runtime/CLAUDE.md`
- Create: `libs/runtime/tests/spread-ref.test.ts`
- Maybe create: `scratchpad/compile-rs-patches/spread-ref.patch.md` (Rust half)
- Modify: `libs/ui/src/utils/dom-tags.tsx` (drop the 18 explicit `ref={props.ref}` once the spread handles it — only after the test passes), `libs/ui/CLAUDE.md`, `libs/cdk/CLAUDE.md` (gotcha)

**Interfaces:**
- Produces: `<a {...props} />` where `props.ref` is a ref object / callback sets the ref exactly like `ref={props.ref}`. Consumed by Task 4 (cdk `render`) and Task 8.

- [ ] **Step 1: Write the failing test** `libs/runtime/tests/spread-ref.test.ts` (DOM target via the test register, happy-dom; copy the harness style of `libs/runtime/tests/dom-v2-spread.test.ts` — read it first for the import/`installDom` idiom):

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.ts";

test("spread: a `ref` key sets the ref object on the element (static spread)", async () => {
  installDom();
  const { ref } = await import("@rivetjs/reactivity");
  const { Probe } = await import("./fixtures/spread-ref.tsx");
  const r = ref<HTMLElement>();
  const root = Probe({ props: { ref: r, id: "x" } }) as unknown as HTMLElement;
  assert.equal(r.value, root);
  assert.equal(root.id, "x");
});

test("spread: a `ref` callback runs once with the element; the key is never written as an attribute", async () => {
  installDom();
  const { Probe } = await import("./fixtures/spread-ref.tsx");
  const seen: unknown[] = [];
  const root = Probe({ props: { ref: (el: HTMLElement) => seen.push(el), id: "y" } }) as unknown as HTMLElement;
  assert.deepEqual(seen, [root]);
  assert.equal(root.hasAttribute("ref"), false);
});

test("spread: ref plus an accessor attribute: an update keeps the same element and calls ref once", async () => {
  installDom();
  const { signal, flush } = await import("@rivetjs/reactivity");
  const { Probe } = await import("./fixtures/spread-ref.tsx");
  const cls = signal("a");
  let calls = 0;
  const root = Probe({ props: { ref: () => void calls++, class: () => cls() } }) as unknown as HTMLElement;
  cls.set("b");
  flush();
  assert.equal(root.className, "b");
  assert.equal(calls, 1);
});
```

Fixture `libs/runtime/tests/fixtures/spread-ref.tsx`: `export const Probe = ({ props }: { props: Record<string, unknown> }) => <a {...props} />;`. Check how neighbouring tests locate helper / fixture dirs (`ls libs/runtime/tests | head`) and match; adjust import paths accordingly. Add `ref` / `flush` names after confirming in `libs/reactivity/index.ts`.

- [ ] **Step 2: Run to fail.** `npx vitest run libs/runtime/tests/spread-ref.test.ts --project runtime --maxWorkers=2` → FAIL (ref ignored, `r.value` undefined).

- [ ] **Step 3: Find the locus.** `grep -n "ref" libs/runtime/dom-v2-spread.ts`. If the runtime `_spread(el, obj)` iterates keys and skips `ref` (or writes it via `setAttribute`), the fix is runtime-only: at the start of the key loop, `if (k === "ref") { applyRef(el, v); continue; }` where `applyRef` mirrors the existing `ref={…}` lowering helper (grep `_ref` / `applyRef` in `libs/runtime/dom-v2.ts`; reuse it, do not duplicate). If the compiler strips `ref` from spreads at compile time (inspect `compile({ target: "dom" })` output for the fixture, `libs/compiler/tests/` has a `compile` helper), the fix is Rust: write `scratchpad/compile-rs-patches/spread-ref.patch.md` (diff of the spread lowering in `libs/compiler/rust/src/compile/**`, what/why, verify = Step 2 tests + `npx nx run compiler:parity` + zero-cost), message the root agent, mark Step 1 test 1 `test.fails("… (spread-ref.patch.md)")`, and commit only the tests + docs now.

- [ ] **Step 4: Implement the runtime half** (if that is the locus), run Step 2 command → PASS; run `npx vitest run --project runtime --maxWorkers=2` and `--project runtime-dev` → PASS.

- [ ] **Step 5: Consumers.** After the fix lands (not while `test.fails`): in `libs/ui/src/utils/dom-tags.tsx` remove the explicit `ref={props.ref}` on each tag if the spread now covers it (run `npx vitest run --project ui` after); delete the ref-in-spread gotcha lines from `libs/ui/CLAUDE.md` Known diffs / `src/utils/CLAUDE.md`; add the rule to `libs/runtime/CLAUDE.md` ("`ref` in `{...spread}` is applied like an explicit `ref` attribute").

- [ ] **Step 6: Measure.** `node apps/dom-bench/…` is overkill for a key check; instead record the `_spread` micro-bench before/after (`libs/runtime/tests/bench` if present, otherwise a 1e6-iteration loop in the PR description) — the loop added one string comparison per key; reject the change if `sh scripts/zero-cost/check.sh` shows a runtime hash change that the size report flags above 50 bytes without the same test passing in `runtime-dev`.

- [ ] **Step 7: Commit** (own-hunk recipe if `dom-v2-spread.ts` shows foreign hunks):

```bash
git add libs/runtime/tests/spread-ref.test.ts libs/runtime/tests/fixtures/spread-ref.tsx
git commit -m "fix(runtime): ref key inside {...spread} is applied

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- libs/runtime/dom-v2-spread.ts libs/runtime/tests/spread-ref.test.ts libs/runtime/tests/fixtures/spread-ref.tsx libs/runtime/CLAUDE.md libs/ui/src/utils/dom-tags.tsx libs/ui/CLAUDE.md libs/ui/src/utils/CLAUDE.md
```

(Runtime hash changes → `sh scripts/zero-cost/check.sh --update` is a root-gate step at Task 24, not here.)

---

### Task 3: `dom.*` accepts accessor props (prerequisite P4)

**Files:**
- Modify: `libs/ui/src/utils/dom.tsx` (`DOMProps`), `libs/ui/src/utils/dom-tags.tsx` (param types)
- Create: `libs/ui/tests/dom.types.tsx`
- Modify: `libs/ui/CLAUDE.md`, `libs/ui/src/utils/CLAUDE.md`, remove the `@ts-expect-error` lines in `libs/ui/tests/dom.test.tsx` / `dom.server.test.tsx` that this fixes

**Interfaces:**
- Produces: `DOMProps<E>` where every attribute of `JSX.IntrinsicElements[E]` may also be a `() => value` accessor (what the compiler accepts for reactive attributes), with `render` and `ref` unchanged.

- [ ] **Step 1: Write the failing type test** `libs/ui/tests/dom.types.tsx` (checked by `tsc -p libs/ui`; no runtime):

```tsx
import { dom } from "../src/utils/dom.tsx";
import type { DOMProps } from "../src/utils/dom.tsx";

declare const cls: () => string;
declare const dis: () => boolean;

// accessor attributes are accepted (no @ts-expect-error needed)
export const a = <dom.div class={() => cls()} data-x={() => "1"} />;
export const b = <dom.button disabled={dis} aria-pressed={() => true} />;
// plain values still fine
export const c = <dom.span class="x" id="y" />;
// wrong value types still rejected, accessor or not
// @ts-expect-error number is not a string class
export const d = <dom.div class={1} />;
// @ts-expect-error accessor must return the attribute type
export const e = <dom.div class={() => 1} />;

type DivProps = DOMProps<"div">;
export const f: DivProps = { class: () => "a", children: "x" };
```

- [ ] **Step 2: Run to see failure.** `npx tsc -p libs/ui` → errors on `a`, `b`, `f` (accessor not assignable).

- [ ] **Step 3: Implement.** In `libs/ui/src/utils/dom.tsx` replace the `DOMProps` definition:

```ts
type AccessorAttrs<P> = { [K in keyof P]: K extends "ref" | "children" | "render" | `on${string}` ? P[K] : P[K] | (() => P[K]) };
/** Props of `dom.<E>`: the element's props (each attribute may be an accessor, as the compiler allows) + `render`. */
export type DOMProps<E extends keyof JSX.IntrinsicElements> = DOMRenderProps<E, any> & AccessorAttrs<JSX.IntrinsicElements[E]>;
```

Check `libs/runtime/jsx-runtime` types first: if `JSX.IntrinsicElements` attributes already include `| (() => T)` for some keys, apply the mapped type only where missing (the test `e` must still fail). Update each `export const <tag> = (props: DOMProps<"…">)` in `dom-tags.tsx` only if its parameter type is spelled out differently (they use `DOMProps<E>`; verify with grep).

- [ ] **Step 4: Run** `npx tsc -p libs/ui` → PASS; `npx vitest run --project ui --maxWorkers=2` → PASS. Remove the `@ts-expect-error` workarounds listed in Files; `tsc` must still pass (an unused `@ts-expect-error` is an error — this confirms the fix).

- [ ] **Step 5: Docs + commit.** `libs/ui/src/utils/CLAUDE.md`: "`DOMProps` accepts accessors". Remove Plan 1 F3 mention.

```bash
git add libs/ui/tests/dom.types.tsx
git commit -m "feat(ui): dom.* props accept accessor attributes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- libs/ui/src/utils/dom.tsx libs/ui/src/utils/dom-tags.tsx libs/ui/tests/dom.types.tsx libs/ui/tests/dom.test.tsx libs/ui/tests/dom.server.test.tsx libs/ui/CLAUDE.md libs/ui/src/utils/CLAUDE.md
```

---

### Task 4: cdk `render` helper + core parts (Button, Link, Separator, Header, Label, Text, Heading, Keyboard)

**Files:**
- Create: `libs/cdk/utils/render.ts`, `libs/cdk/tests/render-core.browser.test.tsx`, `libs/cdk/tests/render-server.test.ts`
- Modify: `libs/cdk/utils/index.ts` (export), `libs/cdk/button/index.tsx`, `libs/cdk/link/index.tsx`, `libs/cdk/separator/index.tsx`, `libs/cdk/header/index.tsx`, `libs/cdk/label/index.tsx`, `libs/cdk/text/index.tsx`, `libs/cdk/heading/index.tsx`, `libs/cdk/keyboard/index.tsx`, each module's `CLAUDE.md`, `libs/cdk/CLAUDE.md`, `apps/cdk-docs` (the page of each module: "`render`" section; generated routes regenerate), `libs/cdk/NOTICE` (no change needed — same upstream)

**Interfaces:**
- Produces in `libs/cdk/utils/render.ts`:
  ```ts
  import type { JSX } from "@rivetjs/runtime/jsx-runtime";
  export type DOMRenderFunction<E extends keyof JSX.IntrinsicElements, T> = (props: JSX.IntrinsicElements[E], renderProps: T) => JSX.Element;
  export interface DOMRenderProps<E extends keyof JSX.IntrinsicElements, T> { render?: DOMRenderFunction<E, T>; }
  /** RAC `useRenderProps`/`dom` override: the part's attributes (incl. `ref`) go to `render`, else to the default element. */
  export function renderElement<E extends keyof JSX.IntrinsicElements, T>(render: DOMRenderFunction<E, T> | undefined, props: JSX.IntrinsicElements[E], renderProps: T, fallback: (props: JSX.IntrinsicElements[E]) => JSX.Element): JSX.Element;
  ```
  `renderElement` = `render ? render(props, renderProps) : fallback(props)`. `renderProps` is the part's existing render-props object of accessors (e.g. `ButtonRenderProps`: `isPressed()` …). Each part declares `extends DOMRenderProps<"button", ButtonRenderProps>` on its props, strips `render` from the DOM spread (`OWNED` list), and builds the element as `renderElement(props.render, attrs, renderPropsObject, (p) => <button {...p} />)`.
- Consumes: Task 2 (`ref` in spread: `<a {...props} />` inside the user's `render` attaches `props.ref`).

- [ ] **Step 1: Write the failing tests** `libs/cdk/tests/render-core.browser.test.tsx` (Chromium; copy the mount/cleanup idiom of an existing `libs/cdk/tests/button.browser.test.tsx` — read it first):

```tsx
// RAC `render` prop (react-aria-components DOMRenderProps) on the core parts. Ports: RAC Button/Link render cases.
import { test, expect } from "vitest";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Separator } from "@rivetjs/cdk/separator";
import { mount } from "./helpers/mount.tsx";

test("Button render: the returned element replaces <button>, keeps data/aria attrs, receives renderProps accessors", async () => {
  const seen: boolean[] = [];
  const { container } = mount(
    <Button data-testid="b" onPress={() => {}} render={(props, rp) => { seen.push(rp.isPressed()); return <a {...props} href="#x" />; }}>go</Button>,
  );
  const el = container.querySelector("[data-testid=b]")!;
  expect(el.tagName).toBe("A");
  expect(el.textContent).toBe("go");
  expect(seen).toEqual([false]);
});

test("Button render: ref reaches the rendered element (spread carries ref)", async () => {
  let got: Element | undefined;
  const { container } = mount(<Button ref={(e: HTMLElement) => (got = e)} render={(props) => <span {...props} />}>x</Button>);
  expect(got).toBe(container.querySelector("span"));
});

test("Link render: <a> replaced by a custom element keeps href / data-* state attrs", () => {
  const { container } = mount(<Link href="/z" render={(props) => <b {...props} />}>l</Link>);
  const el = container.querySelector("b")!;
  expect(el.getAttribute("href")).toBe("/z");
});

test("Separator render", () => {
  const { container } = mount(<Separator render={(props) => <hr {...props} data-r="1" />} />);
  expect(container.querySelector("hr[data-r=1]")).not.toBeNull();
});
```

and add the same shape for Header (`render={(p) => <h4 {...p}/>}`), Label, Text, Heading (`level`), Keyboard (`render` → `<span>`). `libs/cdk/tests/render-server.test.ts`: SSR via `tests/server.ts` renders a Button with `render` to `<a …>` markup without hydration markers diverging (assert string contains `<a ` and not `<button`). Where Task 2 has not landed (`ref` assert), mark that single test `test.fails` with a comment.

- [ ] **Step 2: Run to fail.** `npx vitest run --project cdk-browser libs/cdk/tests/render-core.browser.test.tsx --maxWorkers=2` and `--project cdk libs/cdk/tests/render-server.test.ts` → FAIL (`render` ignored: button stays `<button>`).

- [ ] **Step 3: Implement the helper** (`libs/cdk/utils/render.ts` as in Interfaces; header per cdk convention: Apache-2.0, © Adobe, ported from RAC `src/utils.tsx` `DOMRenderProps`).

- [ ] **Step 4: Wire each of the 8 parts.** For `libs/cdk/button/index.tsx` (read lines 169-290): add `render` to `ButtonProps` via `extends DOMRenderProps<"button", ButtonRenderProps>`, add `"render"` to `OWNED`, replace the `return (<button …/>)` with `renderElement(props.render, attrs, renderProps, (p) => <button {...p} />)` where `attrs` is the object currently passed attribute-by-attribute (build it once; `ref`, `class`, `style`, handlers, `disabled`, `aria-*` included). Hard constraints: no extra work when `render` is undefined beyond one branch (the SSR / zero-cost hash for button may change; record it for Task 24), `render` must be a user inline arrow (resumable rule; dev-warn is NOT added to cdk — dev check lives in ui `dom.*`, Task 8). Repeat for the other 7 modules using each module's own render-props type (`LinkRenderProps`, `SeparatorProps` has none → `undefined`, `Header`/`Heading`/`Text`/`Label`/`Keyboard` → `undefined`, as RAC passes `undefined`). Remove the "no `render` prop" lines from each module header comment and CLAUDE.md.

- [ ] **Step 5: Port the upstream RAC cases.** RAC test files for these parts live in react-spectrum `packages/react-aria-components/test/{Button,Link,Separator,Header,Label,Text,Heading,Keyboard}.test.js`; the render cases are those matching `/render/` — port them into the matching `libs/cdk/tests/<name>.browser.test.tsx` (existing files) following the existing file-header convention, skipping none.

- [ ] **Step 6: Run** `npx vitest run --project cdk-browser --maxWorkers=2` (full cdk-browser: no regressions), `--project cdk --maxWorkers=2`, `npx tsc -p libs/cdk`, `NX_DAEMON=false npx nx run cdk-docs:typecheck --output-style=static --skip-nx-cache` → PASS.

- [ ] **Step 7: Docs.** `libs/cdk/CLAUDE.md`: "`render` prop" under conventions (`renderElement`, accessor renderProps, `ref` via spread, resumable inline arrow only) + gap #1 progress (8/48). cdk-docs: a "render" subsection on the button + link pages mirroring upstream docs wording (see `apps/cdk-docs` page structure), then `node libs/docs-kit/cli.ts check-content cdk-docs --strict`.

- [ ] **Step 8: Commit**

```bash
git add libs/cdk/utils/render.ts libs/cdk/tests/render-core.browser.test.tsx libs/cdk/tests/render-server.test.ts
git commit -m "feat(cdk): render prop (RAC DOMRenderProps) on Button, Link, Separator, Header, Label, Text, Heading, Keyboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- libs/cdk/utils libs/cdk/button libs/cdk/link libs/cdk/separator libs/cdk/header libs/cdk/label libs/cdk/text libs/cdk/heading libs/cdk/keyboard libs/cdk/tests libs/cdk/CLAUDE.md apps/cdk-docs
```

---

### Tasks 5–7: cdk `render` for the remaining 40 modules (parallel after Task 4)

Each task repeats Task 4 Steps 1–8 for its module list; tests go in `libs/cdk/tests/render-<group>.browser.test.tsx` (one `test` per module asserting the replaced tag, preserved `data-*`/`aria-*`, `ref`, and one renderProps accessor read where the part has render props), plus upstream RAC `render` cases ported into each module's existing browser test. The helper, the OWNED-list rule and the docs rule are Task 4's. The modules and the element each part renders (from `grep -rlE 'no .?render.? prop' libs/cdk`):

### Task 5: `render` — fields and forms

**Modules (Files = each `libs/cdk/<m>/index.tsx` + its `CLAUDE.md`):** `checkbox`, `switch`, `input`, `text-area`, `text-field`, `search-field`, `number-field`, `slider`, `color-field`, `form` (+ `libs/cdk/form/field-error.tsx`), `toggle-button-group`, `group`.
**Create:** `libs/cdk/tests/render-forms.browser.test.tsx`. **Commit:** `feat(cdk): render prop on field and form parts` with pathspec = those module dirs + the test + `libs/cdk/CLAUDE.md` progress row.
- [ ] Step 1 tests as Task 4 (e.g. `Input` → `render={(p) => <input {...p} data-r="1" />}`; `FieldError` renders custom `<div>`; `Slider` track/thumb parts included if they are separate exports in the module).
- [ ] Steps 2–8 as Task 4. Special attention: `checkbox` / `switch` render the label wrapper (`<label>`), RAC passes the state render props; `slider` thumbs/track/output each get `render`.

### Task 6: `render` — collections, menus, overlays

**Modules:** `breadcrumbs`, `combobox`, `grid-list`, `menu`, `tag-group`, `toolbar`, `tooltip`, `popover`, `overlay-arrow`, `modal`, `dialog`, `disclosure`, `toast`, `navigation-tree`, `tree/navigation-context.tsx`, `slots`.
**Create:** `libs/cdk/tests/render-collections.browser.test.tsx`. **Commit:** `feat(cdk): render prop on collection, menu and overlay parts`.
- [ ] Tests as Task 4 (e.g. `Popover` → `render={(p) => <section {...p} />}`; `MenuItem` custom `<a>`). Overlay parts: assert the shared overlay layer still owns stacking (inline styles unchanged) with `render` set.
- [ ] Steps 2–8 as Task 4. `slots/index.tsx` is the RAC `utils` contract file: add `DOMRenderProps` re-export there (RAC exports it from `utils`).

### Task 7: `render` — date, color, progress, rest

**Modules:** `calendar`, `date-field`, `date-picker`, `color-area`, `color-slider`, `color-swatch`, `color-swatch-picker`, `color-thumb`, `color-wheel`, `meter`, `progress-bar`.
**Create:** `libs/cdk/tests/render-date-color.browser.test.tsx`. **Commit:** `feat(cdk): render prop on date, color and progress parts`.
- [ ] Tests as Task 4 (e.g. `ProgressBar` → `render={(p, rp) => <div {...p} data-pct={rp.percentage()} />}`; `ColorSwatch` custom `<span>`).
- [ ] Steps 2–8 as Task 4; final step additionally re-runs the module count: `grep -rlE 'no .?render.? prop' libs/cdk --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=tests` must print nothing (any remaining module = justified `// RAC has no render prop here` comment, listed in `libs/cdk/CLAUDE.md`). Update `libs/cdk/CLAUDE.md` gap #1 to done.

---

### Task 8: `dom.*` and ui parts apply `render`

**Files:**
- Modify: `libs/ui/src/utils/dom-tags.tsx`, `libs/ui/src/utils/dom.tsx` (doc comment), `libs/ui/src/utils/dev-on.ts` / `dev-off.ts` (replace the "render ignored" warning with the upstream "did not attach the ref" check), `scripts/zero-cost/dev-leaks.mjs` (`DEV_MESSAGES`), `libs/ui/CLAUDE.md` (remove the `render` Known diff; add one for the dev ref check wording if it differs), `libs/ui/src/utils/CLAUDE.md`
- Modify: `libs/ui/tests/dom.test.tsx`, `dom.server.test.tsx`, `dev-warning.test.ts`
- Create: `libs/ui/tests/dom-render.test.tsx`

**Interfaces:**
- Consumes: `renderElement` from `@rivetjs/cdk/utils` (Task 4), `ref` in spread (Task 2).
- Produces: `<dom.div render={(props) => <section {...props} />}>` renders `<section>` with all attrs + children + `ref`; parts built on `dom.*` get `render` for free.

- [ ] **Step 1: Write the failing test** `libs/ui/tests/dom-render.test.tsx`:

```tsx
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

test("dom.div render: replaces the element, keeps class / data-slot / children / ref", async () => {
  installDom();
  const { ref } = await import("@rivetjs/reactivity");
  const { dom } = await import("../src/utils/dom.tsx");
  const r = ref<HTMLElement>();
  const el = (<dom.div ref={r} class="c" data-slot="s" render={(props) => <section {...props} />}><b>k</b></dom.div>) as unknown as HTMLElement;
  assert.equal(el.tagName, "SECTION");
  assert.equal(el.className, "c");
  assert.equal(el.getAttribute("data-slot"), "s");
  assert.equal(el.firstElementChild?.tagName, "B");
  assert.equal(r.value, el);
});

test("dom.span render receives renderProps undefined", async () => {
  installDom();
  const { dom } = await import("../src/utils/dom.tsx");
  let rp: unknown = "unset";
  (<dom.span render={(props, renderProps) => ((rp = renderProps), <i {...props} />)}>x</dom.span>);
  assert.equal(rp, undefined);
});
```

Server variant in `dom.server.test.tsx`: same render → markup starts `<section`. `dev-warning.test.ts`: dev build warns when `render` returns an element that dropped the ref (`render={() => <section />}` with a `ref` passed), production bundle contains no message text.

- [ ] **Step 2: Run to fail** (`render` ignored): `npx vitest run libs/ui/tests/dom-render.test.tsx --project ui --maxWorkers=2`.

- [ ] **Step 3: Implement.** In `dom-tags.tsx` each tag `export const div = (props: DOMProps<"div">) => renderElement(props.render, withoutRender(props), undefined, (p) => <div {...p} />)` where the existing `{...{ render: undefined }}` trick is replaced by destructuring once: `const { render, ...rest } = props as any`. Dev ref check through `#dev`: `DEV && render && rest.ref && check(...)` — after `render(...)` returns an element, in development verify `rest.ref` got a value on the next microtask (`queueMicrotask(() => { if (isRef(rest.ref) && rest.ref.value === undefined) warn(...) })`); the message text is the upstream string, registered in `DEV_MESSAGES`. Keep per-tag exports (tree-shaking, Ruling 11).

- [ ] **Step 4: Run** the new test, `npx vitest run --project ui --maxWorkers=2`, `npx tsc -p libs/ui`, and `node scripts/zero-cost/dev-leaks.mjs` (prints `dev leaks: none`). Update the Known-diff docs. Prettier.

- [ ] **Step 5: Commit**

```bash
git add libs/ui/tests/dom-render.test.tsx
git commit -m "feat(ui): dom.* applies the render prop (cdk renderElement)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- libs/ui/src/utils libs/ui/tests/dom-render.test.tsx libs/ui/tests/dom.test.tsx libs/ui/tests/dom.server.test.tsx libs/ui/tests/dev-warning.test.ts scripts/zero-cost/dev-leaks.mjs libs/ui/CLAUDE.md
```

---

### Task 9: Hooks — `useCSSVariable`

**Files:** Create `libs/ui/src/hooks/use-css-variable.ts`, `libs/ui/tests/use-css-variable.test.ts`; modify `libs/ui/CLAUDE.md` (hooks row), `libs/ui/src/utils/CLAUDE.md` or a new `libs/ui/src/hooks/CLAUDE.md` (nearest CLAUDE.md for the new dir). Barrel export waits for Task 24 (root exports are checked by `tests/package.test.ts`: add the name in Task 24 with the other hooks decision).

**Interfaces:** Produces `useCSSVariable(name: string, override?: string, cache = true): string | undefined` — same contract as upstream (`$HEROUI/packages/react/src/hooks/use-css-variable.ts`): returns `override` if defined; `undefined` on the server and on the first render of a client page; otherwise the computed value of the variable on `document.documentElement`, cached per name. Rivet has no hydration pass, so there is no `useIsSSR`: the server markup is `undefined`-variant by construction; a client-created component reads the value at creation.

- [ ] **Step 1: Write the failing test** `libs/ui/tests/use-css-variable.test.ts`:

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

test("useCSSVariable: override wins; server (no document) is undefined", async () => {
  const { useCSSVariable } = await import("../src/hooks/use-css-variable.ts");
  assert.equal(useCSSVariable("--x", "pulse"), "pulse");
  assert.equal(useCSSVariable("--x"), undefined);
});

test("useCSSVariable: reads the computed custom property on :root and caches by name", async () => {
  installDom();
  document.documentElement.style.setProperty("--skeleton-animation", " shimmer ");
  const { useCSSVariable } = await import("../src/hooks/use-css-variable.ts");
  assert.equal(useCSSVariable("--skeleton-animation"), "shimmer");
  document.documentElement.style.setProperty("--skeleton-animation", "pulse");
  assert.equal(useCSSVariable("--skeleton-animation"), "shimmer"); // cached
  assert.equal(useCSSVariable("--skeleton-animation", undefined, false), "pulse"); // cache off
});
```

- [ ] **Step 2: Run to fail** (module missing). `npx vitest run libs/ui/tests/use-css-variable.test.ts --project ui --maxWorkers=2`.
- [ ] **Step 3: Implement** (read the rest of the upstream file first for the empty-string → `undefined` rule and trim; port exactly):

```ts
// Ported from HeroUI v3.2.6 packages/react/src/hooks/use-css-variable.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: not a hook (no React render cycle); `useIsSSR` → `typeof document === "undefined"`; the server (and resume,
// which keeps server markup) uses the default variant, a client-created component reads the variable at creation.
const cache = new Map<string, string | undefined>();

export function useCSSVariable(variableName: string, override?: string, useCache = true): string | undefined {
  if (override !== undefined) return override;
  if (typeof document === "undefined") return undefined;
  if (useCache && cache.has(variableName)) return cache.get(variableName);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  const value = raw === "" ? undefined : raw;
  if (useCache) cache.set(variableName, value);
  return value;
}
```

Test isolation: export `_clearCSSVariableCache()` (test-only, tree-shakes) and call it between tests; add it to the test file imports.
- [ ] **Step 4: Run** → PASS; tsc; prettier. Record in Known diffs: "hooks that were React hooks are plain functions (`useCSSVariable`); `useIsHydrated` / `useMounted` / `useIsSSR` not ported (no hydration pass)".
- [ ] **Step 5: Commit** with pathspec `libs/ui/src/hooks libs/ui/tests/use-css-variable.test.ts libs/ui/CLAUDE.md`.

---

## Phase B — components that work with keyed re-creation today

Common recipe for Tasks 10–18 (**C1–C8**); each task lists only what differs (upstream source, parts, elements, tests, deltas). `<name>` = HeroUI dir.

- **C1 Read** `$HEROUI/…/components/<name>/<name>.tsx`, `index.ts`, the `<name>.stories.tsx` (story ids are used in Plan 3), `$HEROUI/packages/styles/src/components/<name>/` (already vendored in `libs/ui/styles/src/components/<name>/` — confirm the `*Variants` export exists via `grep -n "<name>Variants" libs/ui/styles/src/components/<name>/index.ts`) and upstream tests under `tests/components/<name>/`.
- **C2 Failing tests first:** `libs/ui/tests/<name>.server.test.tsx` (every part's markup: tag, `data-slot`, class = the vendored `xVariants(...)` output for each variant/size/color value — compute expected strings with the variants function, never hand-typed class names; `class` passthrough on every part; rest props; part outside its root), `libs/ui/tests/<name>.test.tsx` (same on DOM target via `installDom()`; `ref`; context read inside every provider part; `render` prop on `dom.*` parts), `libs/ui/tests/<name>.types.tsx` (default-element props, generic `<X<"span">>`, bad variant `@ts-expect-error`). Port the upstream cases. Run → FAIL (module missing).
- **C3 Implement** `libs/ui/src/components/<name>/<name>.tsx` + `index.ts` per `libs/ui/src/components/CLAUDE.md` "Port pattern" (Global Constraints 1–6, 9); add `export * from "./src/components/<name>/index.ts"` to `libs/ui/index.ts`, the `exports` entry `"./<name>"` in `libs/ui/package.json`, the name list in `tests/package.test.ts`; add any new tag as `export const <tag>` in `dom-tags.tsx`.
- **C4 Story + resume:** `libs/ui/tests-components/app/routes/<name>.tsx` rendering every story-equivalent variant (ids from the upstream stories), `tests-components/<name>.test.ts` (Chromium: SSR markup has no JS before interaction — runtime-entry allowlist rule; for interactive parts, first interaction works on the resumed page; `axe` is Plan 3).
- **C5 Run:** `npx vitest run --project ui --maxWorkers=2`, `--project ui-components --maxWorkers=2`, `npx tsc -p libs/ui`, `node scripts/zero-cost/dev-leaks.mjs`, `npx rivet-check`-style editor check `node libs/language-core/cli.ts -p libs/ui/tsconfig.json` (0 diagnostics).
- **C6 Docs:** row in `libs/ui/src/components/CLAUDE.md` Components table (dir, upstream files, exports, notes: elements, `data-slot`s, context id + value shape), Known diffs in `libs/ui/CLAUDE.md`, `libs/ui/tests-components/CLAUDE.md` (route + test), entry-point list in `libs/ui/CLAUDE.md`.
- **C7 Prettier** on owned files (`npx prettier --write` — `libs/ui/styles/**` is ignored).
- **C8 Commit:** `git add libs/ui/src/components/<name> libs/ui/tests/<name>.* libs/ui/tests-components/app/routes/<name>.tsx libs/ui/tests-components/<name>.test.ts` then `git commit -m "feat(ui): <Name> (HeroUI v3.2.6 port)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- <those paths> libs/ui/index.ts libs/ui/package.json libs/ui/tests/package.test.ts libs/ui/src/utils/dom-tags.tsx libs/ui/src/components/CLAUDE.md libs/ui/CLAUDE.md libs/ui/tests-components/CLAUDE.md`.

### Task 10: Field primitives — `separator`, `header`, `label`, `description`, `error-message`, `field-error`

**Files:** Create `libs/ui/src/components/{separator,header,label,description,error-message,field-error}/` (+ tests, routes as C2/C4, one test file per component). Dependencies: cdk `separator`, `header`, `label`, `text`, `form/field-error` with `render` (Task 4/5).
**Upstream:** all RAC wrappers (`Separator`, `Header`, `Label`, `Text slot="description"|"errorMessage"`, `FieldError`).
**Deltas:**
- `separator`: `SeparatorRoot` resolves `orientation ?? useSlottedContext(SeparatorContext)?.orientation ?? "horizontal"` → cdk slotted context read (`slottedContext`, `libs/cdk/slots`), sets `data-orientation` + `orientation`, class `separatorVariants({ orientation, variant, class })`. Test: inside a `SeparatorContext` provider with `orientation: "vertical"` → `data-orientation="vertical"` and `aria-orientation="vertical"`.
- `header`/`label`/`description`/`error-message`: one-class wrappers (`headerVariants`, `labelVariants`, …) with `data-slot` per upstream; `label` passes `isRequired`/`isInvalid`/`isDisabled` through to cdk Label data-attrs (upstream: `data-required`, … copy exactly from `label.tsx`). Note cdk `data-slot` collision gap #8: assert HeroUI's `data-slot` wins on the element (`label`, `description`, `error-message`); if the cdk part sets its own `data-slot` after the spread, write the failing test and fix in cdk (`libs/cdk/label`, `text`) in this task, documenting it as gap #8 progress in `libs/cdk/CLAUDE.md` and including those paths in the commit.
- `field-error`: cdk `FieldError` render-prop children `({ isInvalid, validationErrors, validationDetails })` accessor form; class via `composeTwRenderProps` (string+string, Plan 1) — test with a failing validation (`isInvalid` true shows message, false renders nothing).
- Commit message: `feat(ui): Separator, Header, Label, Description, ErrorMessage, FieldError`. One commit per component is allowed; keep each green.

### Task 11: `kbd`, `spinner`, `skeleton`, `empty-state`

**Files:** Create `libs/ui/src/components/{kbd,spinner,skeleton,empty-state}/` (+ `kbd.constants.ts`).
**Deltas:**
- `kbd`: parts `Kbd`, `Kbd.Abbr` (`dom.abbr`), `Kbd.Content`; `kbd.constants.ts` verbatim (key → symbol map — these are text, not icon glyphs: keep upstream strings, add a Known-diff note that they are upstream keyboard symbols, not icons). Context `{ variant }`. Elements `dom.kbd` (add tag), `dom.abbr`, `dom.span`. Test the `keyValue` → abbr title mapping against `kbd.constants.ts`.
- `spinner`: upstream renders an inline `<svg>` (`dom.svg`, `dom.circle` already in `dom-tags.tsx`). Do not invent paths: keep the upstream spinner SVG markup exactly as upstream wrote it (it is circle/path geometry authored by HeroUI, copied verbatim, not invented) — if it contains `<path d=…>`, map to lucide `LoaderCircle` via `Icon` and record the visual diff in Known diffs; decision is made by reading `spinner.tsx` in C1 and written in the task notes in `libs/ui/src/components/CLAUDE.md`. Variants size/color; `role="status"`/`aria-label` per upstream.
- `skeleton`: uses `useCSSVariable("--skeleton-animation", animationType)` (Task 9, import from `../../hooks/use-css-variable.ts`); root `animationType` prop; SSR renders the default animation class (variable `undefined`), client-created reads the variable at creation. Test both with `installDom()` and a root style variable.
- `empty-state`: `children || "No results found"` default; `dom.div`; `data-slot="empty-state"`.
- Commit: `feat(ui): Kbd, Spinner, Skeleton, EmptyState`.

### Task 12: `badge`, `chip`, `alert`

**Files:** Create `libs/ui/src/components/{badge,chip,alert}/`.
**Deltas:**
- `badge` / `chip`: context `{ color, size, variant }` (+ `placement` for badge), parts `Badge.Anchor`, `Badge.Label`, `Chip.Label`; string/number children are wrapped in `*Label` (`typeof props.children === "string" || "number"` on the lazy children value — compile check: plain string children reach the component as a string; JSX children are slots and pass through). Test: `<Chip>text</Chip>` wraps in `.chip__label`; `<Chip><b/></Chip>` does not. Multi-key `slotsFor` key `${color}|${size}|${variant}`.
- `alert`: parts `Alert.Indicator` (default lucide icon per `status` via `Icon`: danger/warning/success/accent → map like upstream's per-status inline svg, one lucide icon per status recorded as Known diff), `Alert.Content`, `Alert.Title`, `Alert.Description`; context `{ status }`.
- Commit: `feat(ui): Badge, Chip, Alert`.

### Task 13: `typography`

**Files:** Create `libs/ui/src/components/typography/` — `Text`, `Heading`-family exports exactly as upstream `index.ts` (read it: names, `render`, level/size props), based on cdk `text` / `heading`.
**Deltas:** `Heading` level → `h1…h6` via cdk Heading `level`; classes from `typographyVariants`; `dom.*` tags needed (`h1…h6`, `strong`, `em`, …): add exactly the tags the upstream file uses to `dom-tags.tsx`. Test every level and `render`.
- Commit: `feat(ui): Typography`.

### Task 14: `link`, `button`, `close-button`

**Files:** Create `libs/ui/src/components/{link,button,close-button}/`. Needs Task 4 (`render` on cdk Button/Link) and Task 2 for the `render` + `ref` test.
**Deltas:**
- `link`: cdk Link wrapper, `Link.Icon` part (lucide `ArrowUpRight` via `Icon` replaces upstream inline arrow svg; Known diff), `slotsFor` on `variant`, `class` via `composeTwRenderProps` for render-prop classes (cdk values are accessors → string path only; function-form `class` from the user is passed through the adapter).
- `button`: wraps cdk Button; `variant`/`size`/`isIconOnly`/`fullWidth`; `isPending` spinner → `Spinner` (Task 11 import `../spinner/index.ts`; wait for Task 11); `ButtonGroupContext` fallback read (`shouldUseContext`): cdk context plain data `{ variant, size, isDisabled, isIconOnly }` registered `rv-ui-button-group`, default `{}` — the provider side lands with `button-group` in Task 20. Dynamic `isDisabled` / `isPending` / `variant` use the cdk accessor form (cdk Button accepts `T | () => T` for state props): tests pass `isPending={() => p()}` and assert `data-pending` follows without re-creation (this is cdk-level reactivity, not live props); `variant={v()}` plain-prop change is the BLOCKED part (Task 23).
- `close-button`: wraps Button with `Icon name="x"` (lucide `X`; upstream inline svg → Known diff), `aria-label="Close"`, `isDisabled`.
- Tests include the `render` prop (`<Button render={(p) => <a {...p} href="#"/>}>`), press via real click in the Chromium suite (resumed page, first click → `onPress` ran; remember the first-click defer: wait a task before reading DOM).
- Commit: `feat(ui): Link, Button, CloseButton`.

### Task 15: `avatar` (radix Avatar in-tree port)

**Files:** Create `libs/ui/src/components/avatar/` (`avatar.tsx`, `index.ts`), `libs/ui/src/vendor/radix-avatar/avatar-primitive.tsx` (MIT, ~150 LOC), update `libs/ui/NOTICE` (radix avatar MIT notice + source commit), `libs/ui/src/vendor/CLAUDE.md`.
**Interfaces:** Parts `Avatar` (root, context `{ size, color, variant }`), `Avatar.Image`, `Avatar.Fallback`; primitive = loading-status state machine: `idle | loading | loaded | error`, `delayMs` for the fallback, SSR renders the fallback and the `<img>` only after load (no flash), status held in a `signal` (resumable: server renders fallback; resumed page's first image `load` event flips status via inline-arrow handler; use `clientEffect` for the preload `new Image()` probe — server never runs it).
- [ ] Failing tests: SSR markup = fallback only; DOM: with a stubbed `Image` that fires `onload` → image element appears, fallback removed; `onerror` → fallback stays; `delayMs=200` → fallback hidden until the timer (fake timers); `onLoadingStatusChange` callback sequence `["loading","loaded"]`. Chromium: resumed page, image loads after interaction-free load (status changes without a user event: the `clientEffect` runs on resume — assert via the harness `watch()`).
- [ ] Implement from the radix source (`@radix-ui/react-avatar` MIT; fetch the exact version from `$HEROUI/packages/react/package.json` deps / lockfile; vendor the 150 LOC rewritten on signals, header lists source + licence).
- Commit: `feat(ui): Avatar (in-tree radix avatar primitive)`.

### Task 16: Story-app aggregate route + resume regression for the whole wave

**Files:** Create `libs/ui/tests-components/app/routes/wave1.tsx` (all wave-1 components on one resumed page), `libs/ui/tests-components/wave1.test.ts`; modify `libs/ui/tests-components/CLAUDE.md`.
- [ ] Test (Chromium): page loads with zero runtime-entry JS beyond the allowlist before any interaction (`harness.ts` `RUNTIME_ENTRY`); clicking `Button` (`onPress` increments a visible counter in the page) works on first click after a task wait; keyed-`Show` re-creation of `<Button variant>` on a toggle shows the new slot classes; `Chip`/`Badge`/`Alert` markup identical before/after resume (server vs DOM-adopted node count equal).
- [ ] Commit: `test(ui): wave-1 story page resume regression`.

### Task 17: Per-component zero-cost / package mapping check (no `--update`)

**Files:** Modify `libs/ui/tests/package.test.ts` only if Tasks 10–15 left gaps.
- [ ] Run `npx vitest run libs/ui/tests/package.test.ts --project ui --maxWorkers=2` → both-direction subpath mapping PASS for all 20 dirs; root barrel name list includes every new export (and `useCSSVariable` only if the Task 24 decision exports hooks — otherwise the test pins its absence).
- [ ] Commit only if edited: `test(ui): package mapping covers wave-1 components`.

### Task 18: Wave-1 design notes in the spike doc

**Files:** Modify `docs/design/research/2026-10-07-heroui-port-spike.md` → append "§7 Plan 2 findings" (render prop landed shape deltas, `ref` in spread locus, barrel walk, per-component translation notes: Children-text wrapping, avatar primitive, lucide mappings), `docs/CLAUDE.md` is NOT touched (foreign hunks) — add the plan to the index via temp-index recipe only if `docs/CLAUDE.md` lists plans.
- [ ] Commit: `docs: HeroUI port plan 2 findings` with pathspec the spike doc.

---

## Phase C — `BLOCKED-ON-LIVE-PROPS` (do not start before the live-props gate)

Why blocked: each of these takes props that change during a page's life (`value`, `isDisabled`, `variant`, group state fanned out to children) and the interim keyed-re-creation workaround loses focus / state or cannot be expressed by a children-provided plain-data context. They are specified now so the gate opens straight into work.

### Task 19: `progress-bar`, `progress-circle`, `meter` — BLOCKED-ON-LIVE-PROPS

**Files:** Create `libs/ui/src/components/{progress-bar,progress-circle,meter}/`.
**Why blocked:** `value` / `isIndeterminate` change continuously; upstream updates the fill width (`width: ${percentage}%`) and ring `stroke-dashoffset` through render-prop state. cdk `ProgressBar`/`Meter` expose `percentage` accessors for children, but the HeroUI root props (`value`, `color`, `size`) must follow signals without re-creating the track.
**Steps (when unblocked):** C1–C8, plus tests: `<ProgressBar value={v()}>` on a client page and on a resumed page updates fill width twice; `isIndeterminate` toggle; `meter` `valueText` format; context `{ color, size }` + render-prop `values` via cdk accessors; SVG ring in `progress-circle`: stroke geometry copied from upstream numbers (computed, not hand-drawn paths: `circle` with `r`, `stroke-dasharray`), `dom.circle`/`dom.svg` already exist.
- Commit: `feat(ui): ProgressBar, ProgressCircle, Meter`.

### Task 20: `toggle-button`, `button-group`, `toggle-button-group` — BLOCKED-ON-LIVE-PROPS

**Files:** Create `libs/ui/src/components/{toggle-button,button-group,toggle-button-group}/`; depends on Task 14 and cdk gap #6 `ToggleButtonContext` (spec §3 #6: implement in `libs/cdk/toggle-button` here as a faithful RAC port, with RAC's tests ported).
**Why blocked:** `ButtonGroup` fans `variant` / `size` / `isDisabled` / `isIconOnly` to children through context; changing `isDisabled={s()}` on the group must disable existing buttons (they must not be re-created) and the group inspects its children for separators (`Children`) — expressed as context + child registration, which needs props to be live.
**Steps (when unblocked):** C1–C8; tests: group-level `isDisabled` change after resume updates every Button; `ToggleButton` `isSelected` controlled two ways; group `selectionMode`.
- Commit: `feat(ui): ToggleButton, ButtonGroup, ToggleButtonGroup`.

### Task 21: `avatar-group` — BLOCKED-ON-LIVE-PROPS

**Files:** Create `libs/ui/src/components/avatar-group/` (needs Task 15).
**Why blocked:** upstream partitions `Children.toArray(children)` into avatars vs `AvatarGroup.Count` and renders overflow (`max`) from the live child list; the Rivet port provides `{ size, color, variant }` context and counts via child registration signals, which depends on children/props that change after mount (`max={n()}`).
**Steps (when unblocked):** C1–C8 + tests: `max` change recomputes the visible set; count element text `+N`.
- Commit: `feat(ui): AvatarGroup`.

### Task 22: `scroll-shadow` — BLOCKED-ON-LIVE-PROPS

**Files:** Create `libs/ui/src/components/scroll-shadow/`.
**Why blocked:** measured layout (`useRef` + scroll/resize observer → `data-top-scroll` / `data-bottom-scroll`, `isEnabled` / `orientation` / `size` / `visibility` props that change) uses `clientEffect` + cdk `observers`; `hideScrollBar`/`orientation` changes must not re-create the scroll container (scroll position would reset).
**Steps (when unblocked):** C1–C8 + Chromium test: scroll position survives an `orientation` change; `visibility` attribute updates at scroll edges after resume.
- Commit: `feat(ui): ScrollShadow`.

### Task 23: Live-props flip for wave 1 and Card

**Files:** Modify `libs/ui/tests-components/card.test.ts` (remove the `test.fails` on the second change), `libs/ui/tests-components/resume.test.ts`, wave-1 tests that used keyed `Show` as the interim, `libs/ui/CLAUDE.md` (gotchas / translation table row "Re-render on a changed prop"), `libs/ui/src/components/CLAUDE.md`.
- [ ] Step 1: `git grep -n "keyed\|test.fails\|live props" -- libs/ui` → list.
- [ ] Step 2: replace each interim keyed `Show` with the plain reactive prop (`<Button variant={v()}>`, `<Chip color={c()}>`) and assert update without node re-creation (`el` identity before/after) on client-created and resumed pages (two consecutive changes).
- [ ] Step 3: delete `.fails`; run `npx vitest run --project ui --project ui-components --maxWorkers=2` → PASS.
- [ ] Step 4: update docs; commit `test(ui): live props replace keyed re-creation (wave 1, Card)` with the touched paths.

---

## Closing

### Task 24: Plan gates, zero-cost rows, wrap-up

**Files:** Modify `scripts/zero-cost/packages.txt` (only the new `libs/ui` rows + changed cdk/runtime rows with an intended delta), `libs/ui/CLAUDE.md`, `libs/cdk/CLAUDE.md`, `libs/ui/tests/package.test.ts` (hooks decision), `libs/ui/index.ts` (hooks export per decision), `docs/design/research/2026-10-07-heroui-port-spike.md` (status line).
- [ ] Step 1 (clean HEAD copy, Ruling 8): `git worktree` is forbidden — use `git archive HEAD | tar -x -C $S/clean` (+ `ln -s` the root `node_modules`), run `sh scripts/zero-cost/check.sh --update` there, and copy ONLY (a) the new `@rivetjs/ui/<name>` `[dom]`/`[server]` rows, (b) the cdk / runtime rows whose change is the intended `render` / spread-ref delta (state each in the commit body) into the shared `scripts/zero-cost/packages.txt` (hunks of those lines only; temp-index recipe if the file has foreign hunks).
- [ ] Step 2: in the shared tree run the gates and expect green on this plan's paths: `npm run typecheck` (or scoped `npx nx run ui:typecheck`, `cdk:typecheck`, `compiler:typecheck`, `runtime:typecheck`), `NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test --output-style=static --skip-nx-cache -p ui cdk compiler runtime`, `sh scripts/zero-cost/check.sh` (expect `runtime + lanes: identical`, `dev leaks: none`, `condition parity: ok`, `N/N corpus cases match`), `npx nx run compiler:parity`, `npm run size-report -- --check`, `NX_DAEMON=false npx nx run cdk-docs:build`, `node libs/docs-kit/cli.ts check-content cdk-docs --strict`, `node libs/docs-kit/cli.ts check-snippets cdk-docs`, `npm run format:check`, `NX_DAEMON=false npx nx run ui:package`. A failure outside this plan's paths (other lanes' WIP) is reported, not fixed.
- [ ] Step 3: hooks decision: export `useCSSVariable` from the root barrel only if upstream's root `index.ts` exports it (`grep -n "hooks" $HEROUI/packages/react/src/index.ts`); update the barrel name-list test to match; otherwise pin its absence.
- [ ] Step 4: `libs/ui/CLAUDE.md` status: list shipped dirs (`surface`, `card` + wave 1 = 20), the BLOCKED list with the gate condition, remaining dirs (64) by Plan 4 lane; `libs/cdk/CLAUDE.md` gap table: #1 done, #2–#9 remain.
- [ ] Step 5: commit

```bash
git commit -m "chore(ui): plan 2 gates, zero-cost rows (intended delta: new @rivetjs/ui subpaths; cdk + runtime render / spread-ref)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/zero-cost/packages.txt libs/ui/CLAUDE.md libs/cdk/CLAUDE.md libs/ui/tests/package.test.ts libs/ui/index.ts docs/design/research/2026-10-07-heroui-port-spike.md
```

---

## Self-review notes

- Spec coverage: gap #1 (`render`) Tasks 4–8; #8 (`data-slot` collisions) handled where hit (Task 10 label/text); #9 (`"true"` booleans) is audited per component by the class-string tests, full audit stays Plan 3; #2–#7 deferred to Plan 3 (named in the series line). Plan 1 open items a (Task 1) and b (Rust `ui-pure-fragments` patch: root queue, no action here), P3 (Task 2), P4 (Task 3), P1 (gate), P2 done.
- Components: 18 shipped dirs (+ surface/card = 20): separator, header, label, description, error-message, field-error, kbd, spinner, skeleton, empty-state, badge, chip, alert, typography, link, button, close-button, avatar. Blocked: progress-bar, progress-circle, meter, toggle-button, button-group, toggle-button-group, avatar-group, scroll-shadow.
- Open verifications the implementers must do rather than assume (each is a step): runtime `ref` locus (Task 2 Step 3), cdk module render-prop types per part (Task 4 Step 4), upstream spinner SVG content (Task 11), tag list for typography (Task 13).
