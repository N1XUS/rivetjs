# HeroUI v3 port — `@rivetjs/ui` design

- Status: approved 2026-10-07 (brainstorm sections 1–5 + spec questions resolved).
- Goal: external adoption — a complete, familiar styled component kit on Rivet so React/HeroUI users can switch without relearning.
- Upstream: HeroUI v3.2.6 (`heroui-inc/heroui` @ `73000ea`, 2026-10-02). Current release only — no ongoing upstream tracking.
- Gap analysis (session research, summarized here): 86 component dirs (+ `icons.tsx`); nearly every React Aria Components (RAC) symbol already in `@rivetjs/cdk`; gaps listed in §3.

## Decisions

| Topic | Decision |
|---|---|
| Fidelity | 1:1: same components, compound API (`Card.Header`), props, defaults, variants, `data-slot` values, class strings. Every user-visible difference → `known.ts` entry with reason. |
| Behaviour layer | `@rivetjs/cdk` (faithful RAC port) instead of RAC. No second behaviour layer in `libs/ui`. |
| Approach | A: spike → close cdk RAC gaps (cdk freeze lifted for these only) → parity harness → parallel component lanes → docs app. |
| Delivery | All 86 dirs in one push; release when complete (no half kit). |
| Docs | New `apps/ui-docs` on docs-kit (identity B), mirroring HeroUI docs slugs. |
| Themes | Rivet brand theme (logo gradient) = default; HeroUI default theme ships as alternate. |
| Verification | Ported upstream tests + differential behaviour scripts + pixel visual diff vs React storybook + axe per story; one harness drives both sides. |
| License | Treat as Apache-2.0 (root LICENSE, © 2025 NextUI Inc.; package.json says MIT — stricter wins). Port headers per file + `libs/ui/NOTICE` (also radix avatar MIT, input-otp MIT, tailwind-variants MIT). |

## 1. Package layout

```
libs/ui/                      @rivetjs/ui
  UPSTREAM                    heroui v3.2.6 @ 73000ea
  NOTICE                      Apache-2.0 + bundled MIT notices
  src/components/<name>/      one dir per HeroUI dir (86), same file split:
    <name>.tsx                compound parts (Card, Card.Header, …)
    <name>.styles.ts          tv() definitions, verbatim
    index.ts
  src/utils/                  ports of HeroUI helpers (dom.*, slots, compose)
  styles/                     @rivetjs/ui/styles: @heroui/styles CSS vendored verbatim; patches only for known diffs, each listed in `styles/PATCHES.md`
    themes/rivet.css          Rivet brand theme (default)
    themes/heroui.css         upstream default theme (alternate)
  tests/                      ported upstream tests
  stories/                    ported stories (583), shared by harness + docs demos
apps/ui-docs/                 docs site
apps/ui-parity/               React-vs-Rivet harness (React isolated like apps/bench-stable)
```

- Subpaths: `@rivetjs/ui/<name>` per component + `@rivetjs/ui` barrel + `@rivetjs/ui/styles`; zero-cost: each independently tree-shakeable (`scripts/zero-cost` entries added).
- Deps (exact pins): `@rivetjs/cdk`, `@rivetjs/kit/icon` (lucide), `tailwind-variants` 3.3.1 (`twMerge: false`, as upstream), `tw-animate-css` 1.4.0. Peer: Tailwind v4.
- Ported in-tree: radix Avatar (`components/avatar`, ~150 LOC: loading status, `delayMs`, SSR renders fallback without flash, resumable status signal); `input-otp` 1.5.0 (~600 LOC; placement — own subpath vs separate lib — decided by spike).
- React only as devDependency of `apps/ui-parity`; never in published `libs/ui`.

## 2. Translation rules (React → Rivet)

| HeroUI / React | Port |
|---|---|
| `Object.assign(Root, { Header, … })` compound parts | Same shape. Spike proves compiler + resume + HMR + editor treat `<Card.Header>` as a component reference; gaps fixed in compiler (root-only Rust patch), never by changing the API. |
| `forwardRef` | `ref` prop (cdk convention). |
| `useState` / `useMemo` / `useEffect` / `useLayoutEffect` | `signal` / `computed` / `effect` / `clientEffect`; controlled/uncontrolled via cdk `controllable` (value or Signal). |
| tv `slots` functions in context (53 files) | Context carries plain variant props (`{ size, variant, color }`); each part calls its own `tv()` slot. Resume-safe; contexts get `resumableContext(…, { id: "rv-ui-<name>" })`. |
| `cloneElement` / `Children` (12 dirs) | Parent `provide`s injected props; children read context (RAC `Provider` / `slottedContext`). Same DOM. |
| `createCollectionSlot` / `FieldSlotsGate` / `useHasTextSlot` (7 dirs) | cdk collection contexts + hideable parts (`isHiddenPart`, extended in §3). |
| RAC render props (`className={({ isSelected }) => …}`, function children) | Pass through; cdk values are accessors → `composeTwRenderProps` adapter reads them. |
| `render` prop (46 parts) | Pass to new cdk `render` prop (§3). |
| `className` | Rivet `class` only, no `className` alias (user 2026-10-07). Listed on migration page. |
| Event props | Same names (`onPress`, `onSelectionChange`, …). RV1016 bind-once rule applies. |
| Inline SVG icons (15 + check/arrow/spinner) | lucide via `@rivetjs/kit/icon`; listed in `known.ts` as visual diffs. Arrow/spinner/check-draw animations decided per case. |
| `"use client"`, `useIsHydrated` / `useMounted` / `useIsSSR` / `useCSSVariable` | Dropped/replaced (resume, no hydration pass); SSR markup kept identical. |
| React types | Rivet JSX types; same prop names and unions. |

API rule: exported names, props, defaults, `data-slot`, class strings = v3.2.6.

## 3. Spike, then cdk gap phase

### Spike (one lane, ~1 day, throwaway code)

1. Compound parts: `<Card.Header>`, `<Select.Item>`, nested `<Select.Popover><ListBox.Item>` — server, DOM v2, resume (part refs captured/serialized), HMR boundary, language-core diagnostics.
2. Variant data through context: parent variant → child `tv()`; server, resume, change after first event on a resumed page.
3. `render` prop API shape on cdk Button (RAC 1.x `render={(props, renderProps) => <a {...props} />}`; ref check).
4. `input-otp` placement.
- Output: `docs/design/research/2026-10-07-heroui-port-spike.md` + Rust patches queued for root agent if needed.

### cdk gaps (faithful RAC ports + upstream RAC tests; cdk-docs pages updated)

| # | Gap | Dependents | Lane |
|---|---|---|---|
| 1 | `render` DOM-override prop on every RAC part that has it | 46 parts | cross-cutting (after spike) |
| 2 | Composable `Select` (`Select` + `SelectValue` + Popover/ListBox parts); monolith replaced (breaking, in-repo users updated) | select, autocomplete | collections |
| 3 | Tabs parts `Tabs`/`TabList`/`Tab`/`TabPanel`/`TabPanels`, SelectionIndicator, `data-selected/hovered/pressed/focus-visible="true"`, `data-disabled="true"` | tabs | collections |
| 4 | Radio parts `RadioGroup`/`Radio`/`RadioField`/`RadioButton`, `RadioGroupContext` | radio, radio-group, fieldset | forms |
| 5 | Hideable parts + `TextContext.slots` visibility (Header, Separator, Group too) | 7 dirs | collections |
| 6 | `ToggleButtonContext`; reactive `useFocusVisible`; `RouterConfig` type; `getLocalizationScript` (or N/A note) | fieldset, toast, rac | forms / cross-cutting |
| 7 | Behaviour holes HeroUI CSS relies on: menu popover `[data-exiting]`; `--trigger-width` without Group; table resumed selection checkboxes; popover `clearContexts` | dropdown, select/combo-box/autocomplete, table, popover | owning lane |
| 8 | `data-slot` collisions: cdk-set `data-slot` (`errorMessage`, `value-item`, `title`, …) must match RAC / not override HeroUI's on the same element | label, radio-group, select, popover | cross-cutting |
| 9 | Every `data-*` boolean written as `"true"` (audit older modules) | all CSS | cross-cutting |

- Version check: HeroUI pins RAC 1.21.1 / react-aria 3.52.1 — diff against cdk baseline, record in `libs/cdk/NOTICE`.
- Gates per lane: cdk tests + ported RAC tests, cdk-docs build, zero-cost, typecheck, CLAUDE.md updates.
- Order: spike → gap lanes in parallel (collections, forms, cross-cutting) → harness built alongside.

## 4. Parity harness (`apps/ui-parity`)

- Two story apps, one story id space (`button--primary`): React = HeroUI v3.2.6 stories (Vite + React 19, isolated install); Rivet = ported stories. Same `@heroui/styles` Tailwind v4 build + HeroUI theme on both → only components differ.
- Runner: Playwright per story per side; Chromium, + WebKit for overlays/date. Chromium launched `--use-mock-keychain --password-store=basic`, fresh profile.
  1. Visual: screenshot story root, light + dark, pixel diff threshold 0.1 % of pixels; animations off, fonts awaited.
  2. Behaviour: step script per component (`scripts/<component>.ts`: `press`, `click(role, name)`, `type`, `hover`, `tab`); after each step capture a11y tree, `aria-*`/`data-*`/`role`/`tabindex`, focused element, callback log (story args wired to recorder); normalized diff (ids, ordering noise).
  3. axe: Rivet violations ⊆ React violations.
- Default scripts generated per component kind (open/close, keyboard nav, selection, typing); hand-written extras for Select, ComboBox, DatePicker, Table, Toast.
- `apps/ui-parity/known.ts`: `{ story, check, pattern, reason }`; unknown diff fails (same model as the retired DOM v2 parity gate).
- Gate: `npx nx run ui-parity:check`, in CI on `libs/ui` / `libs/cdk` changes; HTML report (per-story status, side-by-side diffs) to scratch.

## 5. Docs app, lanes, done criteria

### `apps/ui-docs`

- docs-kit site (identity B, `docs/design/research/2026-10-07-docs-identity.md`).
- Mirrors HeroUI `content/docs/en/react` slugs (`/docs/components/button`): components (73 pages, 15 categories) + getting-started (15). Out of scope: HeroUI v2→v3 migration pages (62), release notes (26), `cn` locale, HeroUI Native.
- 690 demos → live docs-kit examples (resumable islands), sourced from the ported stories/demos.
- Prop tables generated from `@rivetjs/ui` types (docs-kit API tool).
- Theme switcher (Rivet default / HeroUI); "From HeroUI (React)" migration page: import swap, `class`, refs, events, render-prop accessors, `known.ts` list.
- Prose adapted (not verbatim where licence of docs text is unclear) + attribution footer; code under Apache-2.0.

### Lanes (after spike + gaps; each owns components, tests, stories, behaviour scripts, docs pages, demos)

| Lane | HeroUI dirs |
|---|---|
| forms | button, button-group, close-button, toggle-button, toggle-button-group, checkbox, checkbox-group, radio, radio-group, switch, switch-group, input, input-group, textfield, textarea, input-otp, number-field, search-field, slider, form, fieldset, label, description, error-message, field-error |
| collections | select, combo-box, autocomplete, list-box, list-box-item, list-box-section, menu, menu-item, menu-section, dropdown, tabs, tag, tag-group, table, pagination, breadcrumbs, toolbar, link |
| overlays | modal, alert-dialog, drawer, popover, tooltip, toast, disclosure, disclosure-group, accordion |
| date/color | calendar, calendar-year-picker, range-calendar, date-field, date-input-group, date-picker, date-range-picker, time-field, color-area, color-field, color-input-group, color-picker, color-slider, color-swatch, color-swatch-picker |
| display | card, avatar, avatar-group, badge, chip, kbd, typography, header, separator, surface, skeleton, spinner, progress-bar, progress-circle, meter, scroll-shadow, alert, empty-state |
| infra | `rac` re-exports, `icons.tsx` → lucide map, `src/utils`, styles + themes, harness |

### Done (release) criteria

- All 86 dirs ported; ~657 upstream test cases pass.
- Harness green: visual + behaviour + axe on all 583 stories, light + dark; only `known.ts` diffs.
- `apps/ui-docs` builds; all mirrored pages + demos live; `check-content --strict` / `check-snippets` pass.
- Repo gates: zero-cost (per-component tree-shaking), typecheck, tests; size-report recorded (not gating — speed first).
- `templates/ui` starter (`@rivetjs/ui` + Rivet theme).
- Baseline ssr-bench / dom-bench numbers for a UI-heavy page recorded in `docs/benchmarks/`.

## Risks

| Risk | Mitigation |
|---|---|
| Compound `<X.Y>` unsupported in compiler/resume | Spike first; compiler fix before lanes start. |
| Functions in resumable contexts | Variant data only (§2). |
| Overlay enter/exit attr timing (div overlay layer vs RAC portals) | Behaviour + visual harness per overlay; fix in cdk. |
| Measured-layout components (toast, drawer drag, scroll-shadow, date pickers) | `clientEffect` + per-component resume test (first interaction). |
| Volume (657 tests, 583 stories, 690 demos) | Parallel lanes; generated default behaviour scripts. |
| Icon visual diffs | Known diffs; lucide equivalents chosen per role. |

## Resolved questions

- `className` vs `class` → `class` only (user 2026-10-07).
- Styles source → vendor `@heroui/styles` into `libs/ui/styles`, patched only for listed known diffs (`styles/PATCHES.md`: file, hunk, reason) (user 2026-10-07).
