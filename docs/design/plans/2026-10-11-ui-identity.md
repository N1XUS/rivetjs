# UI identity (ui + cdk own look tweaks and API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@rivetjs/ui` + `@rivetjs/cdk` become Rivet's own: HeroUI look kept and tweaked (concentric radii, spacing scale, icon sizes, per-component CSS, audit fixes), targeted API improvements on RAC-style names (signal-first, live props, fewer wrappers, compound sugar, controlled / uncontrolled symmetry, forms integration), docs organised by task with no "port of" identity wording, Pro gaps built as our components.

**Architecture:** Fork the vendored `@heroui/styles` in place (PATCHES.md → TWEAKS.md), split into per-component compiled CSS imported by each component module, then apply numbered tweaks proven by story-app screenshots. API improvements per component (10 core, then batches), names unchanged (R4: naming review only).

**Tech Stack:** TypeScript (Node 26), Tailwind v4 (build-time only for ui CSS), vitest + Playwright Chromium (story apps), `@rivetjs/forms`, lucide via `@rivetjs/kit/icon`, docs-kit.

**Spec:** [`docs/design/specs/2026-10-11-ui-identity-design.md`](../specs/2026-10-11-ui-identity-design.md) (§0 user rulings R1–R6 are binding: look = tweaks on HeroUI, CSS split byte-identical except listed tweaks, no mass prop rename, pills exempt + `radius="concentric"` opt-in, no second theme).

## Global Constraints

- `S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad`; read `$S/perf/IMPL-COMMON.md` (binding).
- RAM / CPU: heavy commands (docs builds, story-app builds, full vitest projects, size-report, zero-cost) only via `bash $S/heavy.sh …` with **2 slots** for this lane; vitest `--maxWorkers=1`; ≤ 3 GB tree RSS; no long-running dev servers (start → check → kill in one command; never ports 4320–4329).
- Env: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; zsh; repo root, absolute paths.
- Zero-cost: every subpath independently tree-shakeable; new subpaths / changed hashes = intended `sh scripts/zero-cost/check.sh --update` delta named in the commit; after T4 CSS is covered too (`css-reach`).
- Icons: lucide only (`@rivetjs/kit/icon` in ui, local `Icon.tsx` copies in examples); never hand-written SVG paths or UTF glyphs.
- Brand palette = `logo.svg` gradient (`RIVET_BRAND`); accent `oklch(0.52 0.24 264)` unchanged; gradient only on brand surfaces (spec §3.5).
- Look rule (R3): no tweak without a `TWEAKS.md` row (before → after numbers, screenshot ids); unlisted screenshot diffs fail the task.
- Behaviour floor: ported upstream tests stay unchanged; `libs/ui/tests-components/parity-counts.json` never decreases without a listed reason.
- Experimental: breaking changes, no aliases / shims; every in-repo consumer (apps, docs, examples, templates, tests, MCP data, skills) updated in the same task.
- Docs follow code: nearest `CLAUDE.md` + every doc describing a changed API updated in the same commit; generated outputs regenerated (`llms`, MCP data, AI files), never hand-edited.
- Git (shared tree, other lanes commit concurrently): temp index per commit — `export GIT_INDEX_FILE=$S/idx-UIID-$$; git read-tree HEAD; git add -- <own files>` (a file with another lane's uncommitted hunks: blob = HEAD + own hunks via `git hash-object -w` + `git update-index --cacheinfo`), `git commit`, `unset GIT_INDEX_FILE`, then `git show --name-only --format= HEAD | xargs git reset -q --`; post-commit `git diff --stat HEAD~1 HEAD` lists only own files. Never `-A` / `.`, stash, reset --hard, amend, push. Never touch user WIP (`apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `*-tmp.ts`, `docs/blog/**`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No Rust: compiler changes (if a collapse needs one) go as a patch to `$S/patches/UIID-<n>.patch` + `.md`, root builds.

### Gate commands (each task lists which it runs)

```bash
H="bash $S/heavy.sh"
# G-UI      $H npx vitest run --project ui --maxWorkers=1
# G-UIC     $H npx vitest run --project ui-components --maxWorkers=1          # story app, Chromium, incl. screenshots after T1
# G-CDK     $H npx vitest run --project cdk --project cdk-browser --project cdk-components --maxWorkers=1
# G-TYPE    npx nx run ui:typecheck && npx nx run cdk:typecheck (--output-style=static --skip-nx-cache)
# G-ZERO    $H sh scripts/zero-cost/check.sh
# G-SIZE    $H npm run size-report -- --check && $H node scripts/size-report/ui-components.mjs --check
# G-UIDOCS  $H npx nx run ui-docs:build ; node libs/docs-kit/cli.ts check-content apps/ui-docs --strict ; node libs/docs-kit/cli.ts check-snippets apps/ui-docs ; node libs/docs-kit/cli.ts llms apps/ui-docs --check
# G-CDKDOCS same for cdk-docs
# G-AI      node libs/mcp/build-data.ts --check && node libs/mcp/ai/sync.ts --check
# G-FMT     npm run format:check
```

## File Structure (new / renamed)

- `libs/ui/styles/TWEAKS.md` (replaces `PATCHES.md`), `libs/ui/scripts/build-css.ts`, `libs/ui/styles/out/` (generated, gitignored; package output `dist/libs/ui/styles/`), `libs/ui/styles/base.css`.
- `libs/ui/tests-components/visual.test.ts`, `__screenshots__/`, `parity-counts.json`, `a11y.test.ts`, `controlled.test.ts`.
- `libs/ui/tests/styles-split.test.ts`, `libs/ui/tests/geometry.test.ts`, `libs/ui/tests/icons.test.ts`.
- `scripts/size-report/ui-components.mjs` + `ui-components.md`; `scripts/zero-cost/css-reach.mjs`; `scripts/check-identity-wording.ts`.
- `apps/ui-docs/tests/{sections.json,coverage.test.ts}` (replace `upstream-sections.json` drift); `apps/cdk-docs/tests/coverage.test.ts`; `content/start/credits.md` in both sites.

## Task overview

Order (coordinator 2026-10-11): screenshot baselines → CSS-link spike → per-component CSS split (byte-identical proof) → tweaks → API improvements → docs / wording → Pro gaps.

| # | Task | Phase |
| --- | --- | --- |
| T1 | Baselines: screenshots, per-component bytes, parity counts, axe | 0 measure |
| T2 | Spike: SSR `<link>` for CSS imported by source-package `.tsx` | 1 CSS |
| T3 | Fork styles: TWEAKS.md, drop HeroUI theme entry | 1 CSS |
| T4 | Per-component CSS split (identical output) + layers | 1 CSS |
| T5 | Concentric radius tokens + 12 nests (+ pill opt-in hook) | 2 tweaks |
| T6 | Contrast / APCA audit, dark focus, dark hairline, tinted shadows | 2 tweaks |
| T7 | Spacing scale, padding ratios, hit targets, density | 2 tweaks |
| T8 | Icon slot system + stroke per size + 10 slot fixes | 2 tweaks |
| T9 | Motion / state tokens, field rhythm, RTL, spinner + empty sizes | 2 tweaks |
| T10 | Naming review (doc only, R4) | 3 API |
| T11–T20 | Button, TextField, Select, Modal, Drawer, Tabs, Table, Menu, Popover, Form | 3 API |
| T21–T26 | Batches A–F (remaining ~71 components) | 3 API |
| T27 | Root hooks + cdk re-exports in ui | 3 API |
| T28 | cdk framing: rules, headers, root CLAUDE.md | 4 docs |
| T29 | cdk-docs restructure + coverage test | 4 docs |
| T30 | ui-docs IA + template + coverage test | 4 docs |
| T31 | Showcase + examples on the new look | 4 docs |
| T32 | Wording sweep + gate + regenerated outputs + Credits | 4 docs |
| T33–T39 | Pro gaps (partials, S ×3, M ×3) | 5 pro |
| T40 | Kanban component (from the showcase board) | 5 pro |
| T41 | Final measurement report | 6 close |

---

### Task T1: Baselines

**Files:**
- Create: `libs/ui/tests-components/visual.test.ts`, `libs/ui/tests-components/__screenshots__/**`, `libs/ui/tests-components/parity-counts.json`, `libs/ui/tests-components/a11y.test.ts`, `scripts/size-report/ui-components.mjs`, `scripts/size-report/ui-components.md`
- Modify: `libs/ui/tests-components/app/src/routes/*` (add missing story routes: `fieldset`, `list-box-section`, `color-input-group`, `date-input-group`; one `visual/<component>.tsx` matrix route per component: sizes × variants × states incl. focus-visible / disabled / invalid, RTL wrapper), `libs/ui/tests-components/CLAUDE.md`, `scripts/size-report/CLAUDE.md` (or `scripts/CLAUDE.md`), root `package.json` devDependency `@axe-core/playwright` (exact pin)

**Interfaces:**
- Produces: `visual.test.ts` — for each `visual/*` route × {1280, 390} × {light, dark} (+ RTL for 12 directional components): `expect(page).toHaveScreenshot(\`${name}-${w}-${scheme}.png\`, { maxDiffPixelRatio: 0, animations: "disabled" })`.
- Produces: `ui-components.mjs [--check]` → per subpath `{ dom: [min, br], server: [min, br], css: [min, br] }` (CSS = bundled single stylesheet share today: selectors whose block class belongs to the component), table in `ui-components.md`.
- Produces: `parity-counts.json` `{ "<project>/<file>": <test count> }` for cdk, cdk-browser, cdk-components, ui, ui-components (collected with `vitest list --json`).

- [ ] Step 1: matrix story routes (one per component, data-driven from the tv variant keys: `styles/src/components/<name>/*.styles.ts`).
- [ ] Step 2: `visual.test.ts` + record baselines (`--update`), check total PNG size (target < 8 MB; else drop 390 width for non-responsive components and note it).
- [ ] Step 3: `a11y.test.ts` axe on every story route (light + dark) → record current violations as `known` list (no fixes here).
- [ ] Step 4: `ui-components.mjs` + `parity-counts.json` (script `scripts/size-report/parity-counts.mjs --check`).
- [ ] Step 5: record the page CSS number: `templates/starter-ui` built CSS (717,517 B min today) + a 3-component fixture (`scripts/size-report/fixtures/ui-three` = Button + TextField + Modal).

**Tests:** G-UIC (new visual + a11y tests pass against their own baselines), G-UI, G-FMT.
**Commit:** `test(ui): visual, a11y, size and parity baselines for the identity lane`

### Task T2: Spike — SSR CSS links for source-package CSS imports

**Files:**
- Create: `$S/perf/UIID-T2/` (fixture app + findings `UIID-T2.md`)
- Modify (only if the spike finds a router gap): `libs/router/**` CSS collection (+ `libs/router/CLAUDE.md`), tests in `libs/router/tests/`

**Interfaces:**
- Consumes: Vite SSR manifest; rivetRouter resume chunks.
- Produces: rule "a `.tsx` module of a `rivet.source` package that does `import "./x.css"` gets a `<link rel=stylesheet>` in the server HTML of every page whose server render reached the module, deduped, before first paint, CSP nonce-free (link, not style)" — verified or fixed.

- [ ] Step 1: fixture: `@rivetjs/ui/button` with a side-effect CSS import of a tiny file; static + server mode; resumed page; lazy route; overlay content rendered only on open.
- [ ] Step 2: check HTML for the link (server render), check no FOUC (CSS of a component first rendered client-side in an opened overlay must load before the overlay paints: preload with its chunk).
- [ ] Step 3: fix gaps in the router (test per case) or record the workaround (ui `styles` manifest consumed by the router plugin).

**Tests:** router tests for each case; findings doc. **Commit (if code):** `feat(router): link CSS imported by source-package modules on server-rendered pages`

### Task T3: Fork styles

**Files:**
- Create: `libs/ui/styles/TWEAKS.md` (all `PATCHES.md` rows as `TW-001…`, columns id / file / before → after / reason / screenshots)
- Delete: `libs/ui/styles/PATCHES.md`, `libs/ui/styles/heroui.css`, `libs/ui/styles/themes/heroui.css`
- Modify: `libs/ui/scripts/gen-themes.ts` (scoped.css: rivet only, or delete scoped.css if only one theme remains — decide: delete, `data-ui-theme` was for comparing themes), `libs/ui/styles/CLAUDE.md` (fork, TWEAKS rule, re-diff section removed), `libs/ui/CLAUDE.md` (Entry points, Rules "1:1 API" → spec §1.3 rules), `libs/ui/package.json` (exports `./styles/*` unchanged; description), `libs/ui/tests/styles.test.ts` (TWEAKS presence instead of PATCHES), `libs/ui/tests/theme.test.ts`, `apps/ui-docs/content/start/theming.md` + `dark-mode.md` (HeroUI theme entry → `CLASSIC_PRESET` (was `HEROUI_PRESET`; renamed by DEBRAND 2026-10-12) via theme builder), `apps/ui-docs/src/**` users of `heroui.css` / `data-ui-theme`, `templates/starter-ui/src/styles.css` comment
- Modify: every `libs/ui/styles/**/*.{css,ts}` header line 2: `/* Rivet: modified, see TWEAKS.md */` only on files that differ from upstream (today's patched files)

- [ ] Step 1: grep consumers: `grep -rn 'heroui.css\|data-ui-theme\|scoped.css' --include='*.{ts,tsx,css,md}' apps libs templates`.
- [ ] Step 2: move rows, delete files, update consumers + docs.
- [ ] Step 3: `node libs/ui/scripts/gen-themes.ts --check`.

**Tests:** G-UI, G-UIC (screenshots unchanged), G-UIDOCS, G-ZERO (ui `./styles/*` hashes skip CSS: expect identical).
**Commit:** `refactor(ui): own the HeroUI-derived styles (TWEAKS.md), drop the HeroUI theme entry`

### Task T4: Per-component CSS split (identical output)

**Files:**
- Create: `libs/ui/scripts/build-css.ts`, `libs/ui/styles/base.css`, `libs/ui/tests/styles-split.test.ts`, `scripts/zero-cost/css-reach.mjs`
- Modify: every `libs/ui/src/components/<name>/index.ts` (side-effect import of its compiled CSS + CSS of ui components it renders internally), `libs/ui/styles/index.css` (all-in-one = base + every component, compiled), `libs/ui/package.json` (exports `./styles/base.css`, `./styles/<name>.css`; `sideEffects: ["**/*.css"]`), `scripts/package/build.ts` (run build-css), `libs/ui/project.json` (target `css`), `templates/starter-ui/src/styles.css`, `apps/ui-docs/src/styles.css`, `apps/ui-docs/examples/*/src/styles.css` (generated? → `@import "@rivetjs/ui/styles/base.css"` only; components bring their CSS), `scripts/zero-cost/check.sh` (+ css-reach line), `libs/ui/styles/CLAUDE.md`, `libs/ui/CLAUDE.md`, `templates/CLAUDE.md`, `apps/ui-docs/CLAUDE.md`, docs `apps/ui-docs/content/start/installation.md` + `styling.md`

**Interfaces:**
- Produces: `build-css.ts [--check]`: for each `components/<name>.css`, Tailwind v4 compile with `@reference "../themes/shared/theme.css"` + utilities/variants, wrap in `@layer rivet.components`, write `styles/out/<name>.css`; `base.css` = `@layer rivet.base, rivet.components, rivet.utilities, app;` + tokens + base + scrollbar + shared utilities; `--check` regenerates in memory and diffs.
- Produces: `styles-split.test.ts`: normalised rule set (selector + declarations) of `concat(base, all components)` == today's single bundle (captured in T1 as `libs/ui/tests/fixtures/bundle-rules.json`), ignoring order only inside a layer.
- Produces: `css-reach.mjs`: builds 3 fixtures (Button only; Button + TextField + Modal; full) and asserts CSS ⊆ expected component set.

- [ ] Step 1: map component → CSS deps (rules of `.button` used by `button-group`, `toggle-button`, `close-button`: owning file stays `button.css`, dependants import it).
- [ ] Step 2: build-css + base; fix `tw-animate-css` keyframes duplication (emit once in base).
- [ ] Step 3: imports in `index.ts`; ui-docs + templates switch to base import.
- [ ] Step 4: identity proof: styles-split test, screenshots unchanged (G-UIC), docs build screenshots of 5 showcase frames unchanged (docs-kit example screenshot step).
- [ ] Step 5: measure: 3-component page CSS (target ≤ 40 KB min), ui-docs frame CSS before / after; update `ui-components.md` + size-report baseline (intended delta).

**Tests:** G-UI, G-UIC, G-ZERO (new css-reach line), G-SIZE, G-UIDOCS, G-TYPE.
**Commit:** `perf(ui): per-component CSS in cascade layers (page pays only for imported components)` + numbers in body.

### Task T5: Concentric radius tokens

**Files:**
- Modify: `libs/ui/styles/themes/shared/theme.css` (`--r-min`), `components/{dropdown,menu,menu-item,select,list-box,list-box-item,combo-box,autocomplete,popover,card,modal,color-picker,color-area,date-picker,calendar,input-group,number-field,search-field,tabs,accordion}.css`, `TWEAKS.md` (TW rows per nest, spec §3.1 table), `__screenshots__` (named only), `libs/ui/styles/CLAUDE.md` (geometry rule)
- Create: `libs/ui/tests/geometry.test.ts`

**Interfaces:**
- Produces CSS contract: container blocks declare `--r-outer` + `--pad`; `--r-inner: max(var(--r-min, 0px), calc(var(--r-outer) - var(--pad)))`; nested containers re-declare `--r-outer: var(--r-inner)`; items use `border-radius: var(--r-inner)`. Pills exempt (Q3 default).
- Produces: `geometry.test.ts` — Chromium story route renders each nest, reads computed `border-radius` + padding of parent / child, asserts `child = max(parentR − inset, rMin)` for the 12 nests.
- Produces (R5): pills stay exempt; `[data-radius="concentric"] { border-radius: var(--r-inner) }` rule in base — the `radius="concentric"` prop is wired on Button (T11), Chip / Tag (T21 / T25 batches), Tabs (T16); geometry test covers a concentric Button in a Card corner.

- [ ] Steps: add tokens → apply per nest (dropdown / select / combo-box / autocomplete item 16 → 14; popover / card nested surfaces → 8; modal nested → 4; color-area 16 → 12; calendar year cells 16 → 8; addons 12 → 11; vertical tabs pill; accordion focus inset 4 → 8) → screenshots update only for the listed routes → TWEAKS rows with before → after.

**Tests:** geometry test, G-UIC, G-UI. **Commit:** `style(ui): concentric inner radii (inner = outer − padding) across nested surfaces`

### Task T6: Contrast audit + dark refinements

**Files:**
- Modify: `libs/ui/src/theme/contrast.ts` (APCA Lc function, 9 new pairs), `libs/ui/src/theme/presets.ts` (`RIVET_PRESET` dark `focus` L 0.68), `libs/ui/scripts/gen-themes.ts` (dark hairline `--surface-border`, tinted shadows), generated `themes/rivet.css` (overrides; the vendored `themes/default/variables.css` stays untouched), `components/{card,popover,modal,dropdown,select,toast}.css` (dark hairline), `libs/ui/tests/theme.test.ts`, `TWEAKS.md`, `apps/ui-docs/content/start/colors.md` + theme builder page (APCA column), `libs/ui/src/theme/CLAUDE.md` / `libs/ui/CLAUDE.md`

**Interfaces:** `apcaContrast(fg, bg): number` (APCA-W3 0.1.9 formula, Lc), `CONTRAST_PAIRS` += muted on surface levels 1–3, placeholder on field, focus vs background / surface / accent, chart series vs surface; thresholds Lc 60 body / 45 large / 30 non-text.

- [ ] Steps: implement + unit tests against published APCA reference values → run audit → fix failing tokens via preset (not vendored file) → shadows `oklch(0.25 0.02 264 / α)` same α → hairline 8 % white in dark on overlays + cards → screenshots dark only.

**Tests:** G-UI (theme test), G-UIC. **Commit:** `style(ui): APCA + extra WCAG pairs, dark focus ring and hairlines, hue-tinted shadows`

### Task T7: Spacing scale, padding ratios, hit targets, density

**Files:**
- Modify: `themes/shared/theme.css` (`--space-1…8`), `components/{button,chip,tag,kbd,modal}.css` (spec §3.2 table rows that change), `utilities/index.css` (`touch-target` on `@media (pointer: coarse)` ≥ 44; fine ≥ 24), `components/{checkbox,radio,switch,toast,tag,search-field,close-button}.css` (touch-target on hit parts), `base.css` (`[data-density=compact]` overrides), `TWEAKS.md`, `apps/ui-docs/content/start/styling.md` (density section), story routes (density + coarse-pointer emulation)
- Create: `libs/ui/tests/spacing.test.ts` (every padding / gap literal in component CSS is a scale step or listed exception)

- [ ] Steps: scale tokens → off-scale grep (`p-[3px]`, `gap-0.5`, `px-2.5`, `sm:p-10`) → map → ratios (Button lg 16 → 20 x, Chip / Tag y 2 → 4, Kbd x 8 → 6) → hit areas → density.

**Tests:** spacing test, G-UIC (hasTouch context for coarse), G-UI. **Commit:** `style(ui): one spacing scale, per-size padding ratios, 44 px touch targets, density`

### Task T8: Icon slots

**Files:**
- Modify: `libs/kit/icon.tsx` (stroke from `--icon-stroke` when `strokeWidth` unset; `absoluteStrokeWidth` unchanged) + `libs/kit/CLAUDE.md` + kit docs page; `libs/ui/styles/base.css` (`[data-slot="icon"]`, `.icon` rules: `inline-size: var(--icon-size); block-size: var(--icon-size); flex: none`), `components/{button,menu-item,list-box-item,tag,toast,search-field,select,alert,close-button,accordion,chip}.css` (spec §3.3 table), ui parts rendering icons (`libs/ui/src/components/*/` add `data-slot="icon"`), `TWEAKS.md`
- Create: `libs/ui/tests/icons.test.ts` (Chromium: every icon slot's box = optical size for its host font size; no negative margins; stroke matches size)

- [ ] Steps: kit change (zero-cost: kit hash delta) → base rules → per-slot fixes (button 20 / 16 flip aligned to text breakpoint, no `-mx-0.5`; menu chevron 14 → 16; check 10 / 8 → 14; leading 12 → 16; tag 12 → 14; toast close 14/12 → 14 in 24; search clear 12 → 14 in 24; select indicator box 20 p-1 → 16; alert / toast status first-line alignment) → screenshots.

**Tests:** icons test, G-UIC, kit tests (`npx vitest run --project kit --maxWorkers=1`), G-ZERO. **Commit:** `style(ui): icon boxes follow font size (16/20/24) with per-size stroke`

### Task T9: Motion / state tokens, field rhythm, RTL, loading sizes

**Files:**
- Modify: `themes/shared/theme.css` (`--duration-fast 120ms`, `--duration-base 180ms`, `--duration-slow 260ms`, `--ease-smooth: cubic-bezier(0.2, 0, 0, 1)`), components with transitions (via `libs/ui/tests/transitions.test.ts` list), press scale on pill controls, `cursor: var(--cursor-disabled)` on list items / tabs, field anatomy (`--field-gap-label 6px`, `--field-gap-help 4px`, group 16) in `components/{text-field,select,combo-box,date-picker,number-field,search-field,textfield,fieldset,checkbox-group,radio-group}.css`, RTL fixes (`calendar.css:271`, tabs indicator, grep physical `left|right|translate-x` in `components/`), `spinner.css` (size = host icon size), `empty-state.css` sizes sm / md / lg, `card.css` title / description rhythm, `TWEAKS.md`, `libs/ui/tests/transitions.test.ts`, docs `start/animation.md`
- Note: `@rivetjs/motion` (spec 2026-10-11-motion-design) reads these tokens when it lands; no dependency now.

**Tests:** transitions test, G-UIC (incl. RTL routes), G-UI. **Commit:** `style(ui): motion tokens, consistent states, field rhythm, RTL and loading sizes`

### Task T10: Naming review (R4: no code, no rename in this wave)

**Files:**
- Create: `docs/design/research/2026-10-xx-ui-naming-review.md` (+ `docs/CLAUDE.md` research line)

**Content:** one row per candidate with evidence, for a later user decision (memory `cdk-rac-api-decisions` stays in force until then):
- `is*` input booleans → HTML names (`isDisabled` 433 / `isFocused` 153 / `isSelected` 94 / `isInvalid` 91 / `isReadOnly` 74 / `isRequired` 68 / `isOpen` 65 occurrences in cdk; consumers: 988 ui-docs + 635 cdk-docs examples, templates, MCP data); render-prop values unaffected.
- `selectedKey(s)` / `onSelectionChange` / item `id` → `value` / `onChange` / `value`.
- `variant="danger-soft"` (combined) → `variant` × `tone` (count of combined values per component from tv keys).
- cdk `<part>Class` / `<part>Props` → `classes` / `slotProps`.
- cdk subpaths (spec §5 table: announcer ×3, bidi ×2, focus ×5, overlay ×13 Angular internals, `preview-trigger`, `sheet-motion`, `drag-drop/cdk`, `tree/cdk`, `i18n-provider`, `coercion` / `observers` / `layout`).
- Per candidate: precedent (HTML, Solid, Svelte, Radix, RAC), example before / after, lines saved, bytes (prop-name strings in resume state), churn (files), codemod feasibility (TypeScript compiler API, type-checked).

**Steps:** greps + counts → doc → hand to the orchestrator for the user decision.
**Commit:** `docs(research): ui/cdk naming review — candidates with evidence`

### Tasks T11–T20: the 10 core components

Common file set per component `<c>`: `libs/ui/src/components/<c>/*` (+ cdk part if a fold needs a cdk change), `libs/ui/styles/components/<c>.css` (only if a fold changes markup: explicit-part form keeps identical screenshots), `libs/ui/tests/<c>*.test.ts(x)` + `tests-components/<c>.test.ts`, `controlled.test.ts` case, `apps/ui-docs/content/components/<c>.md` (spec page template §6.1), `apps/ui-docs/examples/<c>-*` (migrated by hand to the folded form; behaviour steps unchanged), `apps/ui-docs/api.config.ts` + api regen, `libs/ui/src/components/CLAUDE.md`, `libs/mcp` data, templates using `<c>`.

Names stay RAC-style (R4); spec §4.2 before / after are normative. Each commit body states the win: lines / JSX nodes of the migrated examples, DOM nodes per instance, JS + CSS bytes (`ui-components.mjs`).

- **T11 Button:** `radius="concentric"` opt-in (R5; also on Chip / Tag / Tabs in their batches), `isPending` spinner = icon size; `variant="brand"` (gradient fill, T6 contrast pair). Commit `feat(ui): Button brand variant, concentric radius opt-in`.
- **T12 TextField / Input / TextArea:** shorthand `label`, `description`, `errorMessage`, `placeholder` (forwarded to the Input part) when no children; compound form unchanged. Commit `feat(ui): TextField shorthand props`.
- **T13 Select:** `Select.Item` (= ListBox.Item + auto ItemIndicator, `textValue` from string children), auto Trigger (Value + Indicator) and Popover + ListBox when only items are given, `items` + render function, shorthand `label`; `selectedKey` Signal two-way. Commit `feat(ui)!: Select items sugar, auto trigger and popover`.
- **T14 Modal:** `Modal.Content` (= Backdrop + Container + Dialog; props `size`, `placement`, `backdrop`, `closeButton = true`, `scroll`), `Modal.Header` renders a Heading for string children; explicit parts still exported. a11y: dialog labelled by the header heading (test). Commit `feat(ui)!: Modal.Content folds backdrop/container/dialog`.
- **T15 Drawer:** same as Modal, `placement` on root. Commit `feat(ui)!: Drawer.Content fold, placement on root`.
- **T16 Tabs:** ListContainer folded into List; Indicator automatic (opt-out `indicator={false}`). Commit `feat(ui)!: Tabs ListContainer fold, automatic indicator`.
- **T17 Table:** root = ScrollContainer + Content; `columns` + `items` + row render function; compound form kept; Virtualizer path (HERO-AUDIT lane 6) here if cdk TableLayout landed, else noted. Commit `feat(ui)!: Table root fold + data-driven columns/items`.
- **T18 Menu / Dropdown:** `Dropdown.Menu` renders its popover (Popover part optional), `Dropdown.Item` sugar `icon` (lucide icon data), `shortcut` (text → Kbd), `description`, string children → Label + `textValue`. Commit `feat(ui)!: Dropdown menu fold, item icon/shortcut sugar`.
- **T19 Popover:** `Popover.Content` (= Content + Dialog), `title` shorthand → Heading. Commit `feat(ui)!: Popover.Content fold`.
- **T20 Form + `@rivetjs/forms`:** `<Form form={createForm(...)}>` provides a field context; every ui field with `name` reads value / issues / touched from it and writes on input (no glue); `FieldError` auto from issues; `isInvalid` from issues; submit `isPending` from `form.submitting`; progressive enhancement unchanged (`libs/forms` enhance path); docs `content/start/forms.md` (new) + `site:docs/guides/forms` link. Files additionally: `libs/forms/components.tsx` (field context export if missing), `libs/forms/CLAUDE.md`, `docs/guides/forms.md`. Commit `feat(ui): fields join @rivetjs/forms forms by name`.

Steps (each): API change → tests (unit, server, story, controlled / uncontrolled / resumed, a11y) → examples + page (template) → api regen → CLAUDE.md + MCP data.
Tests (each): G-UI, G-UIC (explicit-part screenshots identical), G-TYPE, G-UIDOCS, G-ZERO, G-SIZE.

### Tasks T21–T26: remaining components in batches

Same file set and steps as T11–T20 (RAC names kept): fold wrapper parts that carry no choice, shorthand where it removes boilerplate, `items` where collections, page template, examples migrated.

- **T21 Batch A — fields & toggles:** input, textarea, input-group, search-field, number-field, input-otp, checkbox, checkbox-group, radio, radio-group, switch, switch-group, slider, fieldset, label, description, error-message, field-error, toggle-button, toggle-button-group, segment, native-select, checkbox-button-group, radio-button-group, number-stepper, rating. Commit `feat(ui)!: fields and toggles on Rivet conventions (batch A)`.
- **T22 Batch B — collections & navigation:** list-box(+item, section), tag, tag-group, combo-box, autocomplete, breadcrumbs, pagination, toolbar, link, navbar, sidebar, app-layout, stepper, inline-select, cell-select, cell-slider, data-grid (Virtualizer for list-box / autocomplete if cdk `ListLayout` landed: HERO-AUDIT lane 5). Commit `… (batch B)`.
- **T23 Batch C — overlays & feedback:** tooltip, alert-dialog, toast, sheet, action-bar, morph, item-morph, accordion, disclosure, disclosure-group, alert, spinner, skeleton, progress-bar, progress-circle, meter, empty-state; resume bug `input-group-with-textarea` re-verify (HERO-AUDIT lane 19). Commit `… (batch C)`.
- **T24 Batch D — date & color:** calendar, calendar-year-picker, range-calendar, date-input-group, date-field, time-field, time-picker, date-picker, date-range-picker, color-swatch, color-area, color-slider, color-input-group, color-field, color-swatch-picker, color-picker. Commit `… (batch D)`.
- **T25 Batch E — display & layout:** surface, card, separator, header, kbd, badge, chip, typography, avatar, avatar-group, button-group, close-button, scroll-shadow, scroll-area, resizable, carousel, lightbox, compare, masonry, bento. Commit `… (batch E)`.
- **T26 Batch F — data viz & AI:** chart, kpi, trend-chip, 14 AI chat dirs (text-shimmer … prompt-input). Commit `… (batch F)`.

Tests (each batch): G-UI, G-UIC, G-TYPE, G-UIDOCS, G-ZERO, G-SIZE, parity counts unchanged.

### Task T27: Root hooks + cdk re-exports

**Files:** `libs/ui/index.ts`, `libs/ui/src/hooks/{use-list-data,use-media-query,use-measured-height,use-theme}.ts`, `libs/ui/src/hooks/CLAUDE.md`, `libs/ui/tests/package.test.ts` (pinned names), `apps/ui-docs/content/start/{dark-mode,introduction}.md`, `libs/ui/CLAUDE.md`
**Interfaces:** `useTheme(): { theme: Signal<"light"|"dark"|"system">, resolved: () => "light"|"dark" }` (kit ThemeScript storage key), `useMediaQuery(q): () => boolean` (server: `false`, resumes without boot), `useListData` = cdk `createListData`; re-exports `Virtualizer`, `ListLayout`, `TableLayout`, `I18nProvider`, `RouterProvider`, `useFilter`, `useLocale`, `isRTL`, `parseColor`.
**Tests:** G-UI, G-ZERO (barrel only). **Commit:** `feat(ui): theme / media / list hooks and cdk re-exports in the barrel`

### Task T28: cdk framing

**Files:** root `CLAUDE.md` (cdk rule → "behaviour + ported tests are the floor; names / docs / API conventions are Rivet's"; repo map rows for ui / cdk / ui-docs / cdk-docs), `libs/cdk/CLAUDE.md` (intro, Rules "Faithful ports" → floor wording, "Deliberate deviations" → "Behaviour notes", component conventions → spec §4.1), `libs/ui/CLAUDE.md` (intro, Rules, Translation rules kept as history), `libs/cdk/package.json` + `libs/ui/package.json` descriptions, `README.md` (positioning lines), memory note for the user (not in repo: tell the orchestrator to update `cdk-aria-faithful-ports.md` memory)
**Rule kept:** file headers `// Ported from …` + NOTICE (licence).
**Tests:** G-FMT, G-AI (AI files quote CLAUDE.md rules? regenerate if so). **Commit:** `docs: ui/cdk identity framing (Rivet UI / Rivet CDK)`

### Task T29: cdk-docs restructure + coverage test

**Files:** `apps/cdk-docs/content/_nav.ts` + `_nav/*.ts` (areas: Start, Build, Components, Primitives), page moves (`content/foundations/*` → `content/build/*` by task, URLs change; redirects not needed: experimental, but internal links + `site:cdk/…` links across sites updated), page template (spec §6.1; "Upstream" section → footnote in Credits), `content/start/credits.md`, `apps/cdk-docs/tests/coverage.test.ts`, `apps/cdk-docs/CLAUDE.md` (Pages template), `apps/ui-docs` + `apps/docs` `site:cdk/` links
**Interfaces:** `coverage.test.ts`: every `@rivetjs/cdk` export documented (`::api` or a props table row), every component page has the template headings, every example has ≥ 1 non-`visible` step.
**Tests:** G-CDKDOCS, coverage test. **Commit:** `docs(cdk-docs): task-based IA, Rivet page template, coverage test`

### Task T30: ui-docs IA + template + coverage

**Files:** `apps/ui-docs/content/_nav.ts` + `_nav/{start,components,patterns,showcase}.ts` (spec §6.1 groups), `content/start/*` rewritten (introduction, installation (per-component CSS), theming, dark mode, styling & `classes`, forms, resumability, migration 0.x → new API (before / after table from spec §4.2), credits), `content/components/overview.md` (generated table from nav + subpath + resume tier), `content/patterns/*.md` (5 pages, examples reused from showcase), stale text list (HERO-AUDIT §3) fixed, `apps/ui-docs/tests/sections.json` + `coverage.test.ts`; delete `tests/upstream-sections.json` + drift parts of `sections.test.ts`; `apps/ui-docs/CLAUDE.md`
**Tests:** G-UIDOCS, coverage test. **Commit:** `docs(ui-docs): task-based IA, Rivet page template, coverage test replaces upstream drift`

### Task T31: Showcase + examples on the new look

**Files:** `apps/ui-docs/examples/showcase-*/**`, demo copy with "HeroUI" strings (e.g. `modal-default` "Welcome to HeroUI" → Rivet copy; grep `HeroUI` in `apps/ui-docs/examples/**/src`), `apps/ui-docs/content/showcase/*.md`
**Steps:** re-run screenshots of showcase frames (docs-kit example screenshots) light + dark, check no layout regressions from T5–T9 tweaks (spacing / icons) — fix example-level Tailwind that fought the old values.
**Tests:** G-UIDOCS. **Commit:** `docs(ui-docs): showcases and demo copy on the Rivet look`

### Task T32: Wording sweep + gate + regenerated outputs

**Files:** `scripts/check-identity-wording.ts` (+ allow-list: `**/NOTICE`, `**/LICENSE*`, file headers `Ported from`, `content/start/credits.md`, `docs/design/**`, `docs/blog/**` (untouched), `libs/ui/UPSTREAM`, `libs/ui/styles/TWEAKS.md`), `.github/workflows/ci.yml` (`gates` job step), `scripts/CLAUDE.md`; every hit file from the spec §6.3 list (README, CLAUDE.md files, `apps/{docs,ui-docs,cdk-docs}/content/**`, `libs/mcp/ai/**`, `templates/**`, `libs/create-rivet/**`, package descriptions, barrel JSDoc, `docs/guides/**`); regenerated: `node libs/docs-kit/cli.ts llms <app>` ×3, `node libs/mcp/build-data.ts`, `node libs/mcp/ai/sync.ts`
**Interfaces:** `node scripts/check-identity-wording.ts [--list]` exits 1 on `/\b(1:1 port|port of|faithful port|HeroUI|React Aria|RAC|upstream)\b/i` outside the allow-list (identity wording only: technical mentions inside Credits / headers allowed).
**Steps:** baseline counts (157 / 224 / 193 / 250 / 16 files) → rewrite → gate passes → regen outputs.
**Tests:** gate, G-AI, G-UIDOCS, G-CDKDOCS, `NX_DAEMON=false npx nx run docs:build`, G-FMT. **Commit:** `docs: Rivet UI / Rivet CDK identity wording everywhere; credits pages; wording gate`

### Tasks T33–T39: Pro gaps as our components (clean-room)

Common: public section / anatomy names only, own code / CSS / content / data, lucide only; built directly on the new conventions + per-component CSS + geometry tokens; file set per component = `libs/ui/src/components/<c>/`, `libs/ui/styles/components/<c>.css` + `src/components/<c>/` tv, `TWEAKS.md` row "Rivet-authored", `libs/ui/index.ts`, `package.json` export, `tests/package.test.ts`, unit + server + story + visual route, `api.config.ts`, page + examples + nav, `libs/ui/src/components/CLAUDE.md`, zero-cost `--update` (intended), Credits line.

- **T33 Partials:** chart split (area / bar / line / pie / chart-tooltip pages + stacked / grouped / horizontal / dashed / dots / nested donut / labels / custom tooltip; `ChartTooltip.*` parts), kpi (+ Progress / Actions / Separator parts) + kpi-group, rating (Item part, 10 sections), trend-chip parts, empty-state sizes / outline / media, stepper / app-layout / sidebar / resizable (`Resizable.Indicator`) / carousel (`useCarousel`) sections, chain-of-thought / prompt-input / data-grid single sections. Commit `feat(ui): chart, kpi, rating, trend-chip and layout sections`.
- **T34 S-1:** cell-switch, cell-color-picker, number-value, emoji-reaction-button. Commit `feat(ui): cell-switch, cell-color-picker, number-value, emoji-reaction-button`.
- **T35 S-2:** item-card, item-card-group, timeline, list-view (cdk `grid-list`). Commit `feat(ui): item-card(-group), timeline, list-view`.
- **T36 S-3:** hover-card (cdk `preview-trigger`), widget. Commit `feat(ui): hover-card, widget`.
- **T37 M-overlays:** context-menu (cdk menu + long-press / contextmenu triggers), command (autocomplete + modal), floating-toc (overlay + scroll spy). Commit `feat(ui): context-menu, command, floating-toc`.
- **T38 M-files:** drop-zone (cdk drag-drop + file-trigger), file-tree (cdk tree + drag-drop). Commit `feat(ui): drop-zone, file-tree`.
- **T39 M-visual:** pressable-feedback (highlight / ripple / hold-confirm / progress; closes `button-ripple-effect` demo), holo-card, radar-chart, radial-chart, composed-chart (own `chart-math.ts`). Commit `feat(ui): pressable-feedback, holo-card, radar/radial/composed charts`.

Tests (each): G-UI, G-UIC, G-TYPE, G-UIDOCS, G-ZERO, G-SIZE.

### Task T40: Kanban component (Pro-L decision 2026-10-11: "we already have it")

Today kanban exists only as the showcase example `apps/ui-docs/examples/showcase-kanban` (page `content/showcase/kanban.md`): one route composing cdk `DropListGroup` / `DropList` / `Drag` (`@rivetjs/cdk/drag-drop`), ui Chip / AvatarGroup / ProgressBar / Button / TextField, board CSS in the example's `styles.css`. No `@rivetjs/ui/kanban` subpath. Pro public sections: Notion Board, Project Board, Sizes.

Coverage vs Pro sections: Project Board ≈ covered by the showcase (columns, cards, keyboard move buttons, add form, live status); Notion Board missing (property chips per card, column counts, collapsed / empty columns); Sizes missing (no component, so no `size`).

**Files:** `libs/ui/src/components/kanban/` (`Kanban`, `Kanban.Column` (header, count, add slot), `Kanban.Card`, `Kanban.MoveMenu` (keyboard / pointer-free move via Dropdown), `size` sm / md / lg; data-driven `columns` + `items` + `onMove(itemId, toColumn, index)`; behaviour = cdk drag-drop, no new behaviour layer), `libs/ui/styles/components/kanban.css` (moved out of the showcase `styles.css`: preview tilt, placeholder, sorting, receiving list) + tv definition, `TWEAKS.md` row "Rivet-authored", `libs/ui/index.ts`, `package.json` export, `tests/package.test.ts`, unit + server + story + visual route, `apps/ui-docs/api.config.ts`, `content/components/kanban.md` (sections Project Board, Notion Board, Sizes, Keyboard, Resumability) + examples `kanban-{project-board,notion-board,sizes}`, showcase migrated onto the component, `libs/ui/src/components/CLAUDE.md`, zero-cost `--update` (intended).
**Tests:** G-UI, G-UIC (drag via stepped CDP mouse events as in cdk-docs drag-drop examples; keyboard move buttons; announcements), G-TYPE, G-UIDOCS, G-ZERO, G-SIZE.
**Commit:** `feat(ui): Kanban component (columns, cards, keyboard moves, sizes) from the showcase board`

### Task T41: Final measurement report

**Files:** `docs/benchmarks/2026-10-xx-ui-identity.md` (+ `.json`), `docs/CLAUDE.md` benchmarks line, `scripts/size-report/ui-components.md` (final)
**Content:** per-component JS / CSS bytes before (T1) / after; 3-component page CSS; starter-ui + ui-docs frame CSS; screenshots changed = TWEAKS rows (count); axe violations before / after; parity counts before / after (≥); ssr-bench ui lane + resume-bench (click / keyClick) within noise; zero-cost lines.
**Tests:** G-SIZE, G-ZERO, full `npx nx run-many -t test` via heavy.sh. **Commit:** `docs(benchmarks): ui identity lane — bytes, a11y, parity, visual deltas`

## Ordering and parallelism

- Strict: T1 → T2 → T3 → T4 → (T5–T9 one at a time: shared screenshots) → T10 (doc, can run any time after T1) → T11–T20 → T21–T27 → T28–T32 → T33–T40; T41 last. Pro-L ruling: agenda = separate AGENDA lane (spec `docs/design/specs/2026-10-12-scheduler-design.md`, port of the user's malva scheduler; not planned here); emoji-picker, map = no; rich-text-editor = not now.
- Parallel after T20: ui batches (T21–T27) + cdk docs lane (T28–T29); ui-docs lane (T30–T32) after T27; Pro lane (T33–T39) after T25 (shared tweaks + per-component CSS) — ≤ 2 heavy slots total.
- Implementation runs through the SDD loop (superpowers:subagent-driven-development) once heavy lanes free.
