# HeroUI port — Plan 1: spike + `libs/ui` foundation + Card reference port

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the compound-part / variant-context translation rules on Rivet (compiler, resume) and stand up `@rivetjs/ui` with vendored `@heroui/styles`, a story app harness, and Surface + Card ported 1:1 as the reference for all later lanes.

**Architecture:** `libs/ui` mirrors HeroUI `packages/react/src/components/<name>/` and vendors `packages/styles` (CSS + `tv()` sources) under `libs/ui/styles`. Parts share plain variant data through resumable contexts; each part calls its own `tv()` slot. A resumed story app (`libs/ui/tests-components`, same harness model as `libs/cdk/tests-components`) with Tailwind v4 verifies SSR markup and resumed updates.

**Tech Stack:** Rivet (`@rivetjs/reactivity`, `@rivetjs/runtime`, `@rivetjs/router`, `@rivetjs/cdk`), Rust/oxc compiler (wasm), tailwind-variants 3.3.1, Tailwind CSS 4.3.3 + `@tailwindcss/vite` 4.3.3, tw-animate-css 1.4.0, Vitest, Playwright.

**Spec:** `docs/design/specs/2026-10-07-heroui-port-design.md`

**Plan series:** Plan 1 (this) → Plan 2 cdk RAC gaps (needs spike findings §Task 1–2) → Plan 3 parity harness `apps/ui-parity` → Plan 4 component lanes (forms, collections, overlays, date/color, display) → Plan 5 `apps/ui-docs`. Each written after the previous one's findings.

## Global Constraints

- Upstream: HeroUI v3.2.6 @ `73000ea`; clone at `$HEROUI=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad/heroui` (re-clone `git clone https://github.com/heroui-inc/heroui && git -C heroui checkout 73000ea` if missing).
- 1:1 API: exported names, props, defaults, `data-slot` values, class strings = v3.2.6. `class` only (no `className`). Every user-visible diff → `known.ts` entry with reason (file created in Plan 3; until then list diffs in `libs/ui/CLAUDE.md` "Known diffs").
- License: Apache-2.0 (© 2025 NextUI Inc.) header on every ported file; `libs/ui/NOTICE`.
- Styles: vendored into `libs/ui/styles`; patches only for listed known diffs in `libs/ui/styles/PATCHES.md` (file, hunk, reason).
- Theme: Rivet brand theme default, HeroUI theme alternate (theme files land in Plan 4; Plan 1 uses HeroUI default theme only).
- Deps exact pins: `tailwind-variants` 3.3.1 (`twMerge: false` as upstream), `tw-animate-css` 1.4.0; peer `tailwindcss` 4.x. React never a dependency of `libs/ui`.
- Icons: lucide via `@rivetjs/kit/icon` only; never hand-written SVG paths, never UTF glyphs.
- Resumability: handlers inline arrows / local consts; contexts carry plain data only; `resumableContext(…, { id: "rv-ui-<name>" })`.
- Rust: only the root agent edits `libs/compiler/rust/**` and builds wasm; implementers write patch files to `scratchpad/compile-rs-patches/` and message the root agent.
- Every run: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH`, `NODE_OPTIONS=--max-old-space-size=3072`, vitest `--maxWorkers=2`, nx `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Chromium: `--use-mock-keychain --password-store=basic`.
- Git: main checkout `perf/ssr-beat-razor`, `git add` specific paths, commit messages end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, no push. Never touch user WIP (`apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `*-tmp.ts`, `docs/blog/**`). Shared files with other lanes' hunks → commit own hunks via temp index.
- Every touched dir's CLAUDE.md updated in the same commit.

## File map

| Path | Responsibility |
|---|---|
| `libs/compiler/tests/compound-parts.test.ts` | Spike 1: `<X.Y>` compile output, server/dom/resume symbol parity |
| `libs/ui/package.json`, `project.json`, `tsconfig.json` | Package wiring (mirrors `libs/forms`) |
| `libs/ui/CLAUDE.md`, `NOTICE`, `UPSTREAM` | Rules, license, upstream pin |
| `libs/ui/styles/**` | Vendored `@heroui/styles` (CSS + `src/**/*.styles.ts`), `PATCHES.md` |
| `libs/ui/src/utils/compose.ts` | `composeSlotClassName`, `composeTwRenderProps` (accessor-aware) |
| `libs/ui/src/utils/dom.tsx` | `dom.*` element helpers (no `render` prop until Plan 2) |
| `libs/ui/src/components/surface/*` | SurfaceContext + Surface |
| `libs/ui/src/components/card/*` | Card compound component |
| `libs/ui/tests/*.test.ts` | Node unit tests (styles, utils, SSR markup) |
| `libs/ui/tests-components/**` | Resumed story app + Playwright suites |
| `vitest.config.ts` | `ui`, `ui-components` projects |
| `scripts/zero-cost/packages-hashes.mjs`, `packages.txt` | `libs/ui` entries |
| `docs/design/research/2026-10-07-heroui-port-spike.md` | Spike findings |

---

### Task 1: Spike — compound parts compile and resume

**Files:**
- Create: `libs/compiler/tests/compound-parts.test.ts`
- Create: `docs/design/research/2026-10-07-heroui-port-spike.md`

**Interfaces:**
- Produces: finding "compound parts OK" or a Rust patch file `scratchpad/compile-rs-patches/ui-compound-1.patch` + root-agent message. Later tasks assume `<Card.Header>` works.

- [ ] **Step 1: Write the tests**

```ts
// Spike (HeroUI port plan 1): JSX member-expression components (`<Card.Header>`) — HeroUI's compound
// API (`Object.assign(Root, { Header, … })`) on 80 modules.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/m.tsx" };
const src = `import { signal } from "@rivetjs/reactivity";
import { Card } from "./card.tsx";
export function V() {
  const v = signal<"default" | "secondary">("default");
  return (
    <Card variant={v()} onClick={() => v.set("secondary")}>
      <Card.Header>
        <Card.Title>t</Card.Title>
      </Card.Header>
      <Card.Content>{v()}</Card.Content>
    </Card>
  );
}`;

for (const target of ["server", "dom"] as const) {
  test(`compound parts: ${target} compiles <Card.Header> as a component, no diagnostics`, () => {
    const out = compile(src, { target, filename: "m.tsx" });
    assert.deepEqual(out.diagnostics, []);
    // Member expressions stay component references (never lowered to a "card.header" element tag).
    assert.match(out.code, /Card\.Header/);
    assert.match(out.code, /Card\.Title/);
    assert.doesNotMatch(out.code, /<card\.header|"card\.header"/i);
  });
}

test("compound parts: resume server/dom symbols match and capture the namespace import", () => {
  const server = compile(src, { target: "server", filename: "m.tsx", resume });
  const dom = compile(src, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(
    server.symbols!.map((s) => [s.id, s.captures]),
    dom.symbols!.map((s) => [s.id, s.captures]),
  );
  // `Card` is a module import: never a capture (imports are re-imported by symbol modules).
  for (const s of dom.symbols!) assert.ok(!s.captures.includes("Card"), `${s.id} captures Card`);
});

test("compound parts: nested namespace <Select.Popover><ListBox.Item> compiles", () => {
  const out = compile(
    `import { Select } from "./s.tsx"; import { ListBox } from "./l.tsx";
export const V = () => <Select><Select.Popover><ListBox><ListBox.Item id="a">A</ListBox.Item></ListBox></Select.Popover></Select>;`,
    { target: "dom", filename: "m.tsx" },
  );
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /ListBox\.Item/);
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run libs/compiler/tests/compound-parts.test.ts --project compiler --maxWorkers=2`
Expected: PASS (compiler already treats member-expression tags as components). If FAIL: record the exact failure, write `ui-compound-1.patch` (unified diff against HEAD, what/why/verify), message the root agent, and mark the failing test `test.fails` with a comment naming the patch until the wasm lands.

- [ ] **Step 3: Commit**

```bash
git add libs/compiler/tests/compound-parts.test.ts
git commit -m "test(compiler): compound part components (<Card.Header>) on server, dom and resume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The resumed behaviour of compound parts + variant context is verified end-to-end in Task 7; findings doc written in Task 8.)

---

### Task 2: `libs/ui` package scaffold

**Files:**
- Create: `libs/ui/package.json`, `libs/ui/project.json`, `libs/ui/tsconfig.json`, `libs/ui/index.ts`, `libs/ui/CLAUDE.md`, `libs/ui/NOTICE`, `libs/ui/UPSTREAM`
- Create: `libs/ui/tests/package.test.ts`
- Modify: `vitest.config.ts` (projects list), root `CLAUDE.md` (repo map row), `scripts/package/smoke.ts` (package list), root `package.json` devDependencies only if Tailwind is not yet hoisted (check `apps/playground/package.json` pins 4.3.3)

**Interfaces:**
- Produces: package `@rivetjs/ui` with `exports` map (`.`, `./card`, `./surface`, `./styles` (CSS), `./styles/*`); vitest projects `ui` (node) and `ui-components` (story app, Task 7).

- [ ] **Step 1: Write the failing test** `libs/ui/tests/package.test.ts`

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package: exact dependency pins, no React", () => {
  assert.equal(pkg.dependencies["tailwind-variants"], "3.3.1");
  assert.equal(pkg.dependencies["tw-animate-css"], "1.4.0");
  for (const deps of [pkg.dependencies, pkg.peerDependencies, pkg.devDependencies])
    for (const name of Object.keys(deps ?? {})) assert.ok(!/^react(-dom)?$|^@types\/react/.test(name), name);
});

test("package: every component subpath points at src/components/<name>/index.ts", () => {
  for (const [key, value] of Object.entries<any>(pkg.exports)) {
    if (!/^\.\/[a-z-]+$/.test(key) || key === "./styles") continue;
    assert.equal(value.default, `./src/components/${key.slice(2)}/index.ts`);
  }
});

test("UPSTREAM pins heroui v3.2.6 @ 73000ea", () => {
  assert.match(readFileSync(new URL("../UPSTREAM", import.meta.url), "utf8"), /heroui v3\.2\.6 @ 73000ea/);
});
```

- [ ] **Step 2: Add the vitest project and run to see it fail**

In `vitest.config.ts` projects, after the `cdk-components` line:

```ts
      node("ui", ["libs/ui/tests/*.test.ts"]),
```

Run: `npx vitest run --project ui --maxWorkers=2` → Expected: FAIL (`package.json` missing).

- [ ] **Step 3: Create the package files**

`libs/ui/package.json`:

```json
{
  "name": "@rivetjs/ui",
  "version": "0.0.0-experimental",
  "license": "Apache-2.0",
  "private": true,
  "type": "module",
  "sideEffects": ["*.css"],
  "rivet": { "source": true },
  "exports": {
    ".": { "types": "./index.ts", "default": "./index.ts" },
    "./surface": { "types": "./src/components/surface/index.ts", "default": "./src/components/surface/index.ts" },
    "./card": { "types": "./src/components/card/index.ts", "default": "./src/components/card/index.ts" },
    "./styles": { "style": "./styles/index.css", "default": "./styles/index.css" },
    "./styles/*": "./styles/*"
  },
  "dependencies": {
    "@rivetjs/cdk": "0.0.0-experimental",
    "@rivetjs/kit": "0.0.0-experimental",
    "@rivetjs/reactivity": "0.0.0-experimental",
    "@rivetjs/runtime": "0.0.0-experimental",
    "tailwind-variants": "3.3.1",
    "tw-animate-css": "1.4.0"
  },
  "peerDependencies": { "tailwindcss": "^4.0.0" },
  "engines": { "node": ">=24" },
  "publishConfig": { "access": "public", "directory": "../../dist/libs/ui" }
}
```

`libs/ui/project.json`:

```json
{
  "name": "ui",
  "projectType": "library",
  "targets": {
    "package": { "executor": "nx:run-commands", "cache": false, "options": { "command": "node scripts/package/build.ts libs/ui" } },
    "test": { "executor": "nx:run-commands", "cache": false, "options": { "command": "vitest run --project ui && vitest run --project ui-components" } },
    "typecheck": { "executor": "nx:run-commands", "cache": false, "options": { "command": "tsc -p libs/ui" } }
  }
}
```

`libs/ui/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["*.ts", "*.tsx", "*/**/*.ts", "*/**/*.tsx"], "exclude": ["**/node_modules", "**/dist"] }
```

`libs/ui/UPSTREAM`:

```
heroui v3.2.6 @ 73000ea (https://github.com/heroui-inc/heroui, 2026-10-02)
packages/react/src/components -> libs/ui/src/components
packages/styles               -> libs/ui/styles
Current release only: no upstream tracking (user decision 2026-10-07).
```

`libs/ui/index.ts`:

```ts
// @rivetjs/ui — 1:1 port of HeroUI v3.2.6 (Apache-2.0, © 2025 NextUI Inc.) on @rivetjs/cdk. Barrel; prefer subpaths.
export * from "./src/components/surface/index.ts";
export * from "./src/components/card/index.ts";
```

`libs/ui/NOTICE`: Apache-2.0 notice block — "This product includes software from HeroUI (https://github.com/heroui-inc/heroui), Copyright 2025 NextUI Inc., licensed under the Apache License 2.0; files under `src/` and `styles/` are modified ports (see each file header)." followed by the full Apache-2.0 text copied from `$HEROUI/LICENSE`, then a "Third-party" section listing tailwind-variants (MIT), tw-animate-css (MIT).

`libs/ui/CLAUDE.md`: header line "> **Keep this file current:** …" (copy from `libs/forms/CLAUDE.md`), purpose, layout (file map rows above), rules (Global Constraints bullets that apply to `libs/ui`), "Translation rules" table (copy spec §2), "Known diffs" (empty list), "Commands" (`npx vitest run --project ui`, `--project ui-components`, `tsc -p libs/ui`).

Root `CLAUDE.md` repo map: add row `| \`libs/ui\` | \`@rivetjs/ui\`: 1:1 HeroUI v3.2.6 port on cdk (compound components, vendored \`@heroui/styles\` + Tailwind v4), story app tests. |`. `scripts/package/smoke.ts`: add `"ui"` to the package list.

- [ ] **Step 4: Install and run**

Run: `npm install` (workspace picks up `libs/ui`; tailwind-variants + tw-animate-css fetched) then `npx vitest run --project ui --maxWorkers=2`
Expected: PASS (3 tests; the subpath test passes vacuously until Tasks 5–6 add dirs — `./surface`/`./card` point at files created there, so run `tsc` only after Task 6).

- [ ] **Step 5: Commit**

```bash
git add libs/ui/package.json libs/ui/project.json libs/ui/tsconfig.json libs/ui/index.ts libs/ui/CLAUDE.md libs/ui/NOTICE libs/ui/UPSTREAM libs/ui/tests/package.test.ts vitest.config.ts CLAUDE.md scripts/package/smoke.ts package-lock.json
git commit -m "feat(ui): @rivetjs/ui package scaffold (HeroUI v3.2.6 port)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Vendor `@heroui/styles`

**Files:**
- Create: `libs/ui/styles/**` (copied), `libs/ui/styles/PATCHES.md`, `libs/ui/styles/CLAUDE.md`
- Test: `libs/ui/tests/styles.test.ts`

**Interfaces:**
- Produces: `libs/ui/styles/src/index.ts` exporting every upstream `*Variants` (e.g. `cardVariants`, `surfaceVariants`) and types (`CardVariants`); CSS entry `libs/ui/styles/index.css`.

- [ ] **Step 1: Write the failing test** `libs/ui/tests/styles.test.ts`

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { cardVariants } from "../styles/src/index.ts";

const styles = new URL("../styles/", import.meta.url);

test("vendored styles: one CSS file per upstream component + index entries", () => {
  const css = readdirSync(new URL("components/", styles)).filter((f) => f.endsWith(".css"));
  assert.ok(css.includes("card.css") && css.includes("button.css"));
  assert.ok(css.length >= 80, `only ${css.length} component css files`);
  for (const f of ["index.css", "base/base.css", "themes/default/index.css", "utilities/index.css", "variants/index.css"])
    assert.ok(existsSync(new URL(f, styles)), f);
});

test("vendored styles: tv() card slots produce upstream class strings", () => {
  const s = cardVariants({ variant: "secondary" });
  assert.equal(s.base(), "card card--secondary");
  assert.equal(s.header(), "card__header");
  assert.equal(s.title({ class: "x" }), "card__title x");
});

test("vendored styles: every ported file carries the Apache-2.0 header; PATCHES.md lists each patched file", () => {
  const patches = readFileSync(new URL("PATCHES.md", styles), "utf8");
  assert.match(patches, /^# @heroui\/styles patches/m);
  const header = readFileSync(new URL("src/components/card/card.styles.ts", styles), "utf8");
  assert.match(header, /Apache-2\.0.*NextUI Inc\./s);
});
```

Note: tailwind-variants slot functions accept `class` and `className`; Rivet callers pass `class`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run libs/ui/tests/styles.test.ts --project ui` → Expected: FAIL (module not found).

- [ ] **Step 3: Copy and header the files**

```bash
cd /Users/denisseverin/Projects/claude-test/rivet
HEROUI=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad/heroui
mkdir -p libs/ui/styles
for d in base components themes utilities variants src; do cp -R "$HEROUI/packages/styles/$d" libs/ui/styles/; done
cp "$HEROUI/packages/styles/index.css" libs/ui/styles/index.css
find libs/ui/styles -name '*.test.*' -delete
```

Prepend to every copied `.ts` file:

```ts
// Ported from HeroUI v3.2.6 packages/styles/<same relative path> (Apache-2.0, © 2025 NextUI Inc.).
```

and to every `.css` file `/* Ported from HeroUI v3.2.6 packages/styles/<path> (Apache-2.0, © 2025 NextUI Inc.). */` — via a script:

```bash
node -e '
const fs=require("fs"),path=require("path");
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const f of walk("libs/ui/styles")){const rel=path.relative("libs/ui/styles",f);
 if(f.endsWith(".ts")) fs.writeFileSync(f,`// Ported from HeroUI v3.2.6 packages/styles/${rel} (Apache-2.0, © 2025 NextUI Inc.).\n`+fs.readFileSync(f,"utf8"));
 else if(f.endsWith(".css")) fs.writeFileSync(f,`/* Ported from HeroUI v3.2.6 packages/styles/${rel} (Apache-2.0, © 2025 NextUI Inc.). */\n`+fs.readFileSync(f,"utf8"));}'
```

Fix imports inside `libs/ui/styles/src/**` that use extensionless relative paths: Rivet packages resolve `.ts` with Node type stripping, so rewrite `from "./x"` → `from "./x.ts"` and directory imports → `/index.ts` (script with a regex over `from "(\.{1,2}/[^"]+)"`; check each target exists; abort on any unresolved).

`libs/ui/styles/PATCHES.md`:

```md
# @heroui/styles patches

Vendored from HeroUI v3.2.6 `packages/styles` @ 73000ea. Only listed patches are allowed.

| File | Hunk | Reason |
|---|---|---|
| all `src/**/*.ts` | relative imports gain `.ts` / `/index.ts` | Node type-stripping resolution (no bundler extension guessing) |
| all files | Apache-2.0 port header | license |
```

`libs/ui/styles/CLAUDE.md`: what is vendored, the no-unlisted-patches rule, how to re-diff against upstream (`diff -r` after stripping the header line), Tailwind v4 requirement (`@import "@rivetjs/ui/styles";` in the app CSS with `@tailwindcss/vite`).

- [ ] **Step 4: Run**

Run: `npx vitest run libs/ui/tests/styles.test.ts --project ui --maxWorkers=2` → Expected: PASS.
Run: `npx tsc -p libs/ui --noEmit` → Expected: no errors from `styles/src` (if upstream types use `tailwind-variants` exports that differ, fix only by import path, never by editing logic; log any extra patch in PATCHES.md).

- [ ] **Step 5: Commit**

```bash
git add libs/ui/styles libs/ui/tests/styles.test.ts
git commit -m "feat(ui): vendor @heroui/styles v3.2.6 (CSS + tv definitions)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Utils — `composeSlotClassName`, `composeTwRenderProps`, `dom.*`

**Files:**
- Create: `libs/ui/src/utils/compose.ts`, `libs/ui/src/utils/dom.tsx`, `libs/ui/src/utils/CLAUDE.md`
- Test: `libs/ui/tests/utils.test.ts`

**Interfaces:**
- Produces:
  - `composeSlotClassName(slotFn: ((a?: { class?: string; [k: string]: unknown }) => string) | undefined, cls?: string, variants?: Record<string, unknown>): string | undefined`
  - `composeTwRenderProps<T>(cls: string | ((v: T) => string) | undefined, tw?: string | ((v: T) => string | undefined)): string | ((v: T) => string)` — cdk render-prop values are accessor objects; the function form receives cdk's render-props object unchanged.
  - `dom.div`, `dom.p`, `dom.h3`, `dom.span`, `dom.section` …: components `(props: JSX.HTMLAttributes & { children?: JSX.Element }) => JSX.Element` that render the element with all props spread. (`render` prop support added in Plan 2.)

- [ ] **Step 1: Write the failing test** `libs/ui/tests/utils.test.ts`

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { composeSlotClassName, composeTwRenderProps } from "../src/utils/compose.ts";
import { cardVariants } from "../styles/src/index.ts";

test("composeSlotClassName: calls the slot with variants + class, falls back to class", () => {
  const s = cardVariants({ variant: "default" });
  assert.equal(composeSlotClassName(s.header, "x"), "card__header x");
  assert.equal(composeSlotClassName(undefined, "x"), "x");
  assert.equal(composeSlotClassName(undefined), undefined);
});

test("composeTwRenderProps: string + string, function + render props", () => {
  assert.equal(composeTwRenderProps("a", "b"), "b a");
  const fn = composeTwRenderProps<{ isSelected: boolean }>((v) => (v.isSelected ? "on" : "off"), "base") as (v: { isSelected: boolean }) => string;
  assert.equal(fn({ isSelected: true }), "base on");
});
```

- [ ] **Step 2: Run** `npx vitest run libs/ui/tests/utils.test.ts --project ui` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `libs/ui/src/utils/compose.ts`

```ts
// Ported from HeroUI v3.2.6 packages/react/src/utils/compose.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: `class` instead of `className`; render props come from @rivetjs/cdk (same shape as RAC's).
import { cx } from "tailwind-variants";

type SlotFn = (args?: { class?: string; [key: string]: unknown }) => string;

export const composeSlotClassName = (slotFn: SlotFn | undefined, cls?: string, variants?: Record<string, unknown>): string | undefined =>
  typeof slotFn === "function" ? slotFn({ ...(variants ?? {}), class: cls }) : cls;

export function composeTwRenderProps<T>(
  cls: string | ((v: T) => string) | undefined,
  tw?: string | ((v: T) => string | undefined),
): string | ((v: T) => string) {
  if (typeof cls !== "function" && typeof tw !== "function") return cx(tw ?? "", cls ?? "") ?? "";
  return (v: T) => cx(typeof tw === "function" ? (tw(v) ?? "") : (tw ?? ""), typeof cls === "function" ? cls(v) : (cls ?? "")) ?? "";
}
```

Check upstream `disabledClasses`, `focusRingClasses`, `ariaDisabledClasses` re-exports in `$HEROUI/packages/react/src/utils/compose.ts`; re-export them from `../../styles/src/index.ts` the same way.

`libs/ui/src/utils/dom.tsx`: read `$HEROUI/packages/react/src/utils/dom.tsx` first. Port the element list verbatim. Each element component spreads props onto the intrinsic element. Rivet components return DOM values; write each as `(props) => <div {...props} />` and so on, generated from one tag list with a typed map. Leave out the `render` override: `render` is ignored and a dev warning says `render prop lands with cdk render support (HeroUI port plan 2)`. List this in `libs/ui/CLAUDE.md` "Known diffs" until Plan 2.

- [ ] **Step 4: Run** → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ui/src/utils libs/ui/tests/utils.test.ts libs/ui/CLAUDE.md
git commit -m "feat(ui): compose + dom utils (HeroUI port)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Surface

**Files:**
- Create: `libs/ui/src/components/surface/surface.tsx`, `index.ts`
- Test: `libs/ui/tests/surface.test.ts`

**Interfaces:**
- Consumes: `surfaceVariants` (styles), `dom.div`, `composeSlotClassName`.
- Produces: `Surface` component, `SurfaceContext` (`resumableContext(createContext<{ variant: () => SurfaceVariants["variant"] } | null>(null, { id: "rv-ui-surface" }))`, same accessor shape as CardContext in Task 6), `SurfaceProps`, `surfaceVariants`, `SurfaceVariants` re-exports — names exactly as `$HEROUI/packages/react/src/components/surface/index.ts`.

- [ ] **Step 1: Read upstream** `$HEROUI/packages/react/src/components/surface/{surface.tsx,index.ts}`. Port it line by line using the spec §2 rules: `React.useMemo` → plain expression (or `computed` when it reads a signal prop), `createContext` + `<Ctx value>` → `createContext` + `provide` from `@rivetjs/reactivity` (check how cdk provides resumable contexts: `grep -rn "resumableContext" libs/cdk | head`, and use the same helper with id `rv-ui-surface`), `className` → `class`.

- [ ] **Step 2: Write the failing SSR test** `libs/ui/tests/surface.test.ts`

```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Surface } from "../src/components/surface/index.ts";

test("surface: SSR markup matches HeroUI v3.2.6 (class + data-slot)", async () => {
  const html = await renderToString(() => <Surface variant="secondary" class="p-4">x</Surface>);
  assert.match(html, /<div[^>]*class="surface surface--secondary p-4"[^>]*data-slot="surface"[^>]*>x<\/div>/);
});
```

Rename the file to `surface.test.tsx` if the `ui` vitest project needs it for `.tsx`, and update the project glob to `libs/ui/tests/*.test.{ts,tsx}`. Take the expected class string from `$HEROUI/packages/styles/src/components/surface/surface.styles.ts`, and the `data-slot` value from upstream `surface.tsx`; if either differs from the regex above, upstream wins, so fix the test.

- [ ] **Step 3: Run** → FAIL; **Step 4: implement** per Step 1; run → PASS.

- [ ] **Step 5: Commit** `git add libs/ui/src/components/surface libs/ui/tests/surface.test.tsx vitest.config.ts` with message `feat(ui): Surface (HeroUI port)` + Co-Authored-By line.

---

### Task 6: Card (reference compound component)

**Files:**
- Create: `libs/ui/src/components/card/card.tsx`, `libs/ui/src/components/card/index.ts`
- Test: `libs/ui/tests/card.test.tsx`

**Interfaces:**
- Consumes: `cardVariants`, `CardVariants` (styles); `SurfaceContext`; `dom.div` / `dom.h3` / `dom.p`; `composeSlotClassName`.
- Produces (names = upstream `card/index.ts`): `Card` (= `Object.assign(CardRoot, { Root, Header, Title, Description, Content, Footer })`), `CardRoot`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, prop types `CardRootProps` (alias `CardProps`), `CardHeaderProps`, `CardTitleProps`, `CardDescriptionProps`, `CardContentProps`, `CardFooterProps`, the `Card` type namespace, `cardVariants`, `CardVariants`.

- [ ] **Step 1: Write the failing test** `libs/ui/tests/card.test.tsx`

```tsx
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Card } from "../src/components/card/index.ts";

const card = (variant?: "default" | "secondary" | "tertiary" | "transparent") =>
  renderToString(() => (
    <Card variant={variant} class="w-[400px]">
      <Card.Header>
        <Card.Title>T</Card.Title>
        <Card.Description>D</Card.Description>
      </Card.Header>
      <Card.Content>C</Card.Content>
      <Card.Footer>F</Card.Footer>
    </Card>
  ));

test("card: default variant markup = HeroUI v3.2.6", async () => {
  const html = await card();
  assert.match(html, /<div[^>]*class="card card--default w-\[400px\]"[^>]*data-slot="card"/);
  assert.match(html, /<div[^>]*class="card__header"[^>]*data-slot="card-header"/);
  assert.match(html, /<h3[^>]*class="card__title"[^>]*data-slot="card-title"[^>]*>T<\/h3>/);
  assert.match(html, /<p[^>]*class="card__description"[^>]*data-slot="card-description"[^>]*>D<\/p>/);
  assert.match(html, /data-slot="card-content"[^>]*>C</);
  assert.match(html, /data-slot="card-footer"[^>]*>F</);
});

test("card: each variant sets its base modifier", async () => {
  for (const v of ["secondary", "tertiary", "transparent"] as const) assert.match(await card(v), new RegExp(`class="card card--${v} `));
});

test("card: compound statics and named exports are the same functions", () => {
  assert.equal(Card.Root, Card);
  assert.equal(typeof Card.Header, "function");
});
```

- [ ] **Step 2: Run** `npx vitest run --project ui --maxWorkers=2` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `card.tsx`. Port `$HEROUI/packages/react/src/components/card/card.tsx` part by part:

```tsx
// Ported from HeroUI v3.2.6 packages/react/src/components/card/card.tsx (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: context carries the variant (plain data, resumable); each part computes its own tv() slot.
import { createContext, provide, useContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { cardVariants, type CardVariants } from "../../../styles/src/index.ts";
import { composeSlotClassName } from "../../utils/compose.ts";
import { dom } from "../../utils/dom.tsx";
import { SurfaceContext } from "../surface/index.ts";

interface CardContextValue {
  variant: () => CardVariants["variant"];
}
const CardContext = resumableContext(createContext<CardContextValue>({ variant: () => "default" }, { id: "rv-ui-card" }));
const slots = () => cardVariants({ variant: useContext(CardContext).variant() });

export interface CardRootProps extends GlobalDOMAttributes<HTMLDivElement> {
  children: Content;
  class?: string;
  /** Visual variant. @default "default" */
  variant?: CardVariants["variant"];
}

export const CardRoot = (props: CardRootProps) => {
  // Props are read lazily (cdk pattern) so a signal-driven `variant` keeps updating after resume.
  const variant = () => props.variant ?? "default";
  const content = () => {
    const { children, class: cls, variant: _v, ...rest } = props;
    return (
      <dom.div class={cardVariants({ variant: variant() }).base({ class: cls })} data-slot="card" {...rest}>
        {children}
      </dom.div>
    );
  };
  return provide(CardContext, { variant }, () =>
    variant() === "transparent" ? content() : provide(SurfaceContext, { variant }, content),
  );
};

export interface CardHeaderProps extends GlobalDOMAttributes<HTMLDivElement> {
  children?: Content;
  class?: string;
}
export const CardHeader = (props: CardHeaderProps) => {
  const { class: cls, ...rest } = props;
  return <dom.div class={composeSlotClassName(slots().header, cls)} data-slot="card-header" {...rest} />;
};

export interface CardTitleProps extends GlobalDOMAttributes<HTMLHeadingElement> {
  children?: Content;
  class?: string;
}
export const CardTitle = (props: CardTitleProps) => {
  const { class: cls, ...rest } = props;
  return <dom.h3 class={composeSlotClassName(slots().title, cls)} data-slot="card-title" {...rest} />;
};

export interface CardDescriptionProps extends GlobalDOMAttributes<HTMLParagraphElement> {
  children?: Content;
  class?: string;
}
export const CardDescription = (props: CardDescriptionProps) => {
  const { class: cls, ...rest } = props;
  return <dom.p class={composeSlotClassName(slots().description, cls)} data-slot="card-description" {...rest} />;
};

export interface CardContentProps extends GlobalDOMAttributes<HTMLDivElement> {
  children?: Content;
  class?: string;
}
export const CardContent = (props: CardContentProps) => {
  const { class: cls, ...rest } = props;
  return <dom.div class={composeSlotClassName(slots().content, cls)} data-slot="card-content" {...rest} />;
};

export interface CardFooterProps extends GlobalDOMAttributes<HTMLDivElement> {
  children?: Content;
  class?: string;
}
export const CardFooter = (props: CardFooterProps) => {
  const { class: cls, ...rest } = props;
  return <dom.div class={composeSlotClassName(slots().footer, cls)} data-slot="card-footer" {...rest} />;
};
```

Verify against real APIs before running:
- `provide(token, value, fn)`, `useContext`, `resumableContext` signatures (`libs/reactivity/index.ts`, `libs/runtime/resume-format.ts:16`).
- A context value holding an accessor (`variant: () => …`) must resume. If the resume rules reject function values in a resumable context, check `docs/guides/resumability.md` "contexts". Then switch to the form cdk uses for reactive context values (see `libs/cdk/disclosure/index.tsx:103-176`), and record the choice in `libs/ui/CLAUDE.md` "Translation rules".
- SurfaceContext must use the same value shape (`{ variant: () => … }`); make Task 5 match.
- Destructuring inside `content()` keeps reads lazy, so updates are tracked; confirm this against how cdk components spread rest props (`globalDOMProps`).

`index.ts`: port upstream `card/index.ts` verbatim, swapping React's `ComponentProps` for the Rivet prop types and pointing the `cardVariants` re-export at `../../../styles/src/index.ts`. Add the Apache header.

- [ ] **Step 4: Run** → Expected: PASS. Run `npx tsc -p libs/ui --noEmit` → Expected: clean.

- [ ] **Step 5: Commit** `git add libs/ui/src/components/card libs/ui/tests/card.test.tsx` → `feat(ui): Card compound component (HeroUI port)` + Co-Authored-By.

---

### Task 7: Story app + resumed behaviour (compound parts + variant context)

**Files:**
- Create: `libs/ui/tests-components/harness.ts`, `app/serve.ts`, `app/vite.config.ts`, `app/src/styles.css`, `app/src/document.ts`, `app/src/routes/_layout.tsx`, `app/src/routes/index.tsx`, `app/src/routes/card.tsx`, `card.test.ts`, `CLAUDE.md`
- Modify: `vitest.config.ts` (`ui-components` project), `libs/ui/CLAUDE.md`

**Interfaces:**
- Consumes: `Card`, `@rivetjs/ui/styles`.
- Produces: `stories()` / `watch()` harness (same API as `libs/cdk/tests-components/harness.ts`) for every later lane.

- [ ] **Step 1: Copy the harness and serve script.** Copy `libs/cdk/tests-components/harness.ts` and `app/serve.ts`, keeping them byte-identical except:
  - paths;
  - `chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] })`;
  - `STORIES_DIST` default `dist`.

  Copy `app/src/document.ts` and `_layout.tsx` from cdk's story app, changing the title to "Rivet UI stories".

  `app/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// ui story app (file routes, resumed): one page per HeroUI component, used by the browser tests.
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] }), tailwindcss()], logLevel: "warn" });
```

`app/src/styles.css`:

```css
@import "tailwindcss";
@import "@rivetjs/ui/styles";
@source "../../../src";
```

Add `tailwindcss` 4.3.3 and `@tailwindcss/vite` 4.3.3 to `libs/ui` devDependencies, with the same pins as `apps/playground`.

- [ ] **Step 2: Story route** `app/src/routes/card.tsx` (port of upstream `card.stories.tsx` "Variants" + a resumed variant toggle):

```tsx
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";

export default function CardStories() {
  const variant = signal<"default" | "secondary" | "tertiary" | "transparent">("default");
  return (
    <main>
      <button id="next" type="button" onClick={() => variant.set(variant() === "default" ? "secondary" : "default")}>
        next
      </button>
      <Card id="c-live" variant={variant()} class="w-[320px]">
        <Card.Header>
          <Card.Title id="c-title">Live</Card.Title>
          <Card.Description>{variant()}</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>Body</p>
        </Card.Content>
      </Card>
      {(["transparent", "default", "secondary", "tertiary"] as const).map((v) => (
        <Card id={`c-${v}`} class="w-[320px]" variant={v}>
          <Card.Header>
            <Card.Title>{v}</Card.Title>
          </Card.Header>
        </Card>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Write the test** `libs/ui/tests-components/card.test.ts`

```ts
// Card — HeroUI v3.2.6 card.stories.tsx Variants, against the resumed story app.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("card: SSR classes + data-slot per variant, styles applied (non-zero padding), no JS before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/card");
  for (const v of ["transparent", "default", "secondary", "tertiary"])
    assert.equal(await page.getAttribute(`#c-${v}`, "class"), `card card--${v} w-[320px]`);
  assert.equal(await page.getAttribute("#c-title", "data-slot"), "card-title");
  assert.notEqual(await page.$eval("#c-default", (el) => getComputedStyle(el).paddingTop), "0px");
  assert.deepEqual(seen.scripts.filter((u) => !u.includes("rivet-loader")), []);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("card: resumed variant change updates root and parts (compound parts + variant context)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/card");
  await page.click("#next");
  await page.waitForFunction(() => document.querySelector("#c-live")?.getAttribute("class") === "card card--secondary w-[320px]");
  assert.equal(await page.textContent("#c-live [data-slot=card-description]"), "secondary");
  assert.equal(await page.getAttribute("#c-title", "class"), "card__title");
  await page.click("#next");
  await page.waitForFunction(() => document.querySelector("#c-live")?.getAttribute("class") === "card card--default w-[320px]");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
```

Before relying on the `watch()` field names and the loader-script filter, check them in the cdk harness; adjust to its actual API. On the first-mouse-click defer, see the root CLAUDE.md gotcha: `waitForFunction` already covers it.

- [ ] **Step 4: Add the vitest project and run.** In `vitest.config.ts`:

```ts
      node("ui-components", ["libs/ui/tests-components/*.test.ts"], { fileParallelism: false }),
```

Run: `npx vitest run --project ui-components --maxWorkers=2`. Expected: PASS.

If the resumed variant test fails, that's a spike finding. Record it:
- what didn't update (the root class vs the parts);
- whether the cause is the compiler (then a Rust patch to the root agent) or the props-reading pattern (then fix `card.tsx` and document the pattern in `libs/ui/CLAUDE.md` "Translation rules").

- [ ] **Step 5: Commit** — `git add libs/ui/tests-components vitest.config.ts libs/ui/package.json libs/ui/CLAUDE.md package-lock.json` → `test(ui): resumed story app + Card behaviour (HeroUI port)` + Co-Authored-By. Add `libs/ui/tests-components/app/dist*` to `.gitignore`, mirroring cdk's entry.

---

### Task 8: Zero-cost entries, spike findings, docs index

**Files:**
- Modify: `scripts/zero-cost/packages-hashes.mjs` (`PACKAGES` gains `"libs/ui"`), `scripts/zero-cost/packages.txt` (via `--update`), `scripts/CLAUDE.md`
- Create: `docs/design/research/2026-10-07-heroui-port-spike.md`
- Modify: `docs/CLAUDE.md` (research index line; your own hunk only), `libs/ui/CLAUDE.md`

- [ ] **Step 1: Add the package.** Add `"libs/ui"` to `PACKAGES` in `scripts/zero-cost/packages-hashes.mjs:14`.

Run: `sh scripts/zero-cost/check.sh`. Expected: new `@rivetjs/ui`, `@rivetjs/ui/card` and `@rivetjs/ui/surface` rows reported as additions, everything else identical. The styles CSS export is skipped automatically ("stylesheets … skipped").

Run: `sh scripts/zero-cost/check.sh --update` (an intended delta; say so in the commit). Then re-run without `--update`; it must print `runtime + lanes: identical`, `dev leaks: none`, `condition parity: ok`, `N/N corpus cases match`.

- [ ] **Step 2: Write the spike findings doc.** Sections:
  1. Compound parts (Task 1 results);
  2. Variant context and resume (Task 7 results, the props-reading pattern chosen);
  3. `render` prop: the API shape for Plan 2 — RAC 1.x `render={(props, renderProps) => <a {...props} />}`, checked against `$HEROUI/packages/react/src/utils/dom.tsx` and how HeroUI parts pass it;
  4. `input-otp` placement decision: subpath `@rivetjs/ui/input-otp` vendoring `input-otp` 1.5.0 under `libs/ui/src/vendor/input-otp/`, or a separate lib. Decide by size and whether any non-HeroUI consumer needs it; default to vendoring;
  5. Translation rule changes discovered;
  6. Inputs for Plan 2: the confirmed cdk gaps list (spec §3) plus anything new.
- [ ] **Step 3: Index the doc.** Add to `docs/CLAUDE.md` research list: ``- `research/2026-10-07-heroui-port-spike.md` — HeroUI port spike: compound parts, variant context on resume, `render` prop shape, input-otp placement, Plan 2 inputs.`` Commit only that hunk via a temp index; the user's blog lines in that file stay uncommitted.
- [ ] **Step 4: Run all gates.**
  - `npx vitest run --project ui --project ui-components --project compiler --maxWorkers=2`;
  - `npx tsc -p libs/ui --noEmit`;
  - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t typecheck --projects=ui --output-style=static --skip-nx-cache`;
  - `node scripts/check-tsx-projects.ts`;
  - `npx prettier --check libs/ui` (excluding the vendored `libs/ui/styles`: add `libs/ui/styles/` to `.prettierignore` so the vendored files stay byte-comparable to upstream).
- [ ] **Step 5: Commit**

```bash
git add scripts/zero-cost/packages-hashes.mjs scripts/zero-cost/packages.txt scripts/CLAUDE.md docs/design/research/2026-10-07-heroui-port-spike.md libs/ui/CLAUDE.md .prettierignore
git commit -m "feat(ui): zero-cost entries + HeroUI port spike findings

zero-cost --update: intended delta (new @rivetjs/ui entries).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Done criteria (Plan 1)

- `<Card.Header>`-style compound parts compile on server/dom/resume (test committed), and a resumed variant change updates root + parts in Chromium.
- `@rivetjs/ui` exists with vendored styles, utils, Surface, Card; SSR markup equals HeroUI v3.2.6 class/`data-slot` strings.
- Zero-cost green with new entries; typecheck, `ui` + `ui-components` tests pass.
- Spike findings doc committed and indexed → input for Plan 2 (cdk RAC gaps).
