# ui / cdk naming review — candidates with evidence (identity plan T10)

> Status: input for a user decision. No code, no rename in this wave (spec `docs/design/specs/2026-10-11-ui-identity-design.md` R4, §4.3, §5). Memory `cdk-rac-api-decisions` (RAC names) stays in force until a decision.

Method (2026-10-12, HEAD `perf/ssr-beat-razor`): regex word counts over `libs/cdk` (src vs `tests/`), `libs/ui/src`, `libs/ui/tests*`, `apps/ui-docs/examples`, `apps/cdk-docs/examples`, `apps/*/content/**/*.md`, `templates/`, `libs/mcp`. Cells = occurrences / files. Bytes: `apps/ui-docs/dist/client` (3960 prerendered pages, 382 MB HTML, build 04:51).

## 1. `is*` input booleans → HTML names

| prop | cdk src | cdk tests | ui src | ui tests | ui-docs ex | cdk-docs ex | docs md | templates | mcp |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| `isDisabled` | 1367 / 153 | 416 / 81 | 183 / 28 | 186 / 85 | 126 / 81 | 146 / 111 | 318 / 118 | 8 / 8 | 1 / 1 |
| `isSelected` | 387 / 53 | 154 / 41 | 39 / 10 | 86 / 26 | 116 / 26 | 123 / 51 | 137 / 41 | 0 | 0 |
| `isInvalid` | 434 / 43 | 69 / 24 | 27 / 6 | 54 / 22 | 101 / 34 | 39 / 27 | 159 / 51 | 40 / 16 | 7 / 3 |
| `isReadOnly` | 264 / 38 | 104 / 27 | 12 / 4 | 2 / 2 | 10 / 6 | 28 / 25 | 71 / 34 | 0 | 0 |
| `isRequired` | 227 / 30 | 103 / 30 | 12 / 8 | 42 / 24 | 83 / 51 | 42 / 33 | 99 / 37 | 0 | 0 |
| `isOpen` | 287 / 39 | 235 / 31 | 114 / 20 | 102 / 31 | 68 / 18 | 69 / 34 | 137 / 35 | 72 / 40 | 16 / 9 |
| `isFocused` | 351 / 68 | 27 / 8 | 12 / 1 | 0 | 0 | 39 / 20 | 73 / 44 | 0 | 0 |
| `isIndeterminate` | 41 / 8 | 23 / 7 | 20 / 4 | 26 / 10 | 10 / 5 | 19 / 11 | 22 / 6 | 0 | 0 |

- Proposal: `disabled`, `selected`, `invalid`, `readOnly`, `required`, `open`, `indeterminate` on component props. `isFocused` / `isHovered` / `isPressed` are mostly render-prop / state values (`({ isFocused }) => …`): out of scope (render props keep `is*`, like RAC and Kobalte).
- Precedent: HTML (`disabled`, `required`, `readonly`, `open` on `<details>` / `<dialog>`), Radix / Ark / Kobalte (Solid) / Bits UI (Svelte) / Melt (`disabled`, `required`, `open`), RAC + HeroUI keep `is*`.
- Example: `<TextField isRequired isInvalid={bad()}>` → `<TextField required invalid={bad()}>`; `<Modal isOpen={open}>` → `<Modal open={open}>`.
- Lines saved: 0 (rename). Chars: 2 per use.
- Bytes: 15 602 quoted `is*` keys in prerendered resume state across ui-docs → 31 KB raw of 382 MB (0.008 %); brotli ≈ 0. Not a size argument; DX / HTML familiarity only.
- Churn: ≈ 700 files (cdk src + tests ≈ 600 occurrences-heavy, ui ≈ 150, examples ≈ 390, docs md ≈ 360 files incl. generated API tables).
- Risks: collision with real DOM attributes on spread roots (`disabled` on a `div` root via `globalDOMProps` / `_spread`) — needs a filter per component; `open` vs `defaultOpen` symmetry kept; RA hook options (`useButton({ isDisabled })`) — rename at the component layer only or everywhere (hooks are ported 1:1; upstream tests use the RA names).
- Codemod: feasible with the TypeScript compiler API (type-checked: rename JSX attribute only where the target component's props type has the new name); docs md fences by the same pass over extracted snippets (`check-snippets`).

## 2. `selectedKey(s)` / `onSelectionChange` / item `id` → `value` / `onChange` / `value`

| name | cdk src | cdk tests | ui src | ui tests | ui-docs ex | cdk-docs ex | docs md | templates | mcp |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| `selectedKey` | 132 / 17 | 71 / 19 | 4 / 1 | 21 / 9 | 36 / 21 | 16 / 14 | 24 / 10 | 0 | 0 |
| `selectedKeys` | 267 / 40 | 170 / 28 | 5 / 3 | 33 / 17 | 73 / 34 | 58 / 42 | 76 / 29 | 24 / 24 | 5 / 5 |
| `defaultSelectedKey(s)` | 70 / 19 | 45 / 19 | 4 / 1 | 24 / 15 | 14 / 13 | 15 / 12 | 36 / 25 | 0 | 0 |
| `onSelectionChange` | 121 / 25 | 356 / 30 | 6 / 1 | 35 / 13 | 3 / 3 | 40 / 20 | 59 / 29 | 24 / 24 | 5 / 5 |
| `textValue` (context) | 221 / 44 | 232 / 34 | 10 / 2 | 116 / 35 | 503 / 134 | 135 / 52 | 57 / 21 | 8 / 8 | 1 / 1 |

- Proposal: Select / ComboBox / Tabs / RadioGroup-like single selection → `value` / `defaultValue` / `onChange` (Select already exposes `value` + `onChange` in ui: P3-COLLECTIONS); multiple → `value: Set | "all"`. Item `id` → `value` only where the item is a form option (ListBox in a Select), `id` kept for collections in general (GridList, Table rows).
- Precedent: HTML `<select value>`, Radix / Ark / Bits UI (`value`, `onValueChange`), Kobalte (`value`, `onChange`), RAC (`selectedKey`; RAC Select moved to `value` in 2025 too).
- Example: `<Tabs selectedKey={tab} onSelectionChange={setTab}>` → `<Tabs value={tab}>` (Signal two-way, spec §4.1).
- Bytes: 169 `selectedKey(s)` / `onSelectionChange` keys per ~400 pages sampled; < 0.001 %.
- Churn: ≈ 300 files. Conflict: `onChange` already means "value changed" on fields; on collections with both selection and action (`onAction`) the name stays unambiguous.
- Codemod: feasible (type-checked JSX attribute rename per component), item `id` → `value` NOT mechanical (ids double as React keys / collection keys).

## 3. `variant="danger-soft"` (combined) → `variant` × `tone`

- Combined values today: only Button (`danger`, `danger-soft` among `primary | secondary | tertiary | outline | ghost | danger | danger-soft`). Chip / Badge / Avatar / TrendChip already split `variant` (`soft`, …) × `color` (`accent | danger | success | warning | default`).
- Uses: `variant="danger"` 41, `variant="danger-soft"` 5 (examples + docs + story app, 37 files).
- Proposal: Button `color="danger"` + `variant="primary | soft | …"` like Chip — one axis name (`color`, already used by 70 example props) rather than a new `tone`.
- Win: consistent API across Button / Chip / Badge; enables `soft` × `success` / `warning` without new tv keys. CSS: today 2 Button classes; the split needs `variant × color` compound variants (measure with `ui-components.mjs`: expect + ≈ 0.3–0.6 k min for 4 colours × 2 variants).
- Churn: 37 files. Codemod: trivial (string literal map).

## 4. cdk `<part>Class` / `<part>Props` → `classes` / `slotProps`

- `<part>Class` props: 56 distinct names in 24 cdk source files (`panelClass` ×8, `itemClass` ×5, `overlayClass` / `headerClass` / `descriptionClass` ×3, `sheetClass`, `previewClass`, `labelClass`, `errorClass`, `emptyClass` …). Example consumers: 6 ui-docs + 15 cdk-docs examples.
- `<part>Props`: 100 distinct names, but mostly React Aria hook RESULTS (`labelProps` ×42, `descriptionProps` ×32, `inputProps` ×30, `errorMessageProps` ×24, `inProps` ×44 internal) — not a component-prop candidate; renaming them breaks the 1:1 hook ports.
- Proposal: component-level `classes={{ panel, item, header }}` replacing `<part>Class` (MUI / Mantine `classNames` / HeroUI `classNames` precedent); hooks untouched.
- Win: one prop per component, discoverable via one type; resume state: one object capture instead of N strings (same bytes).
- Churn: 24 + 21 files. Codemod: feasible (collect `<part>Class` attributes into one object literal).

## 5. cdk module subpaths (spec §5)

148 cdk exports today. External importers (files outside `libs/cdk`, docs pages):

| today | ext files | docs pages | after (spec §5) |
| --- | --: | --: | --- |
| `announcer`, `live-announcer`, `a11y/live-announcer` | 8, 2, 2 | 2, 0, 0 | `announcer` |
| `bidi`, `bidi-dir` | 11, 4 | 2, 1 | `direction` |
| `focus`, `focus-scope`, `focus-ring`, `a11y/focus-monitor`, `a11y/focus-trap` | 12, 6, 6, 4, 6 | 2, 1, 1, 1, 1 | `focus` + `focus/{scope,ring,monitor,trap}` |
| `overlay` + 9 Angular internals (`overlay-strategy`, `-ref`, `-container`, `-dispatchers`, `scroll-strategies`, `global-position`, `connected-position`, `overlay-position-builder`, `overlay-service`) | 4; internals 1–3 each | 0 | `overlay` + `overlay/{position,scroll,service}` |
| `preview-trigger/behaviour` | 1 | 0 | `hover-card` |
| `sheet-motion` | 6 | 1 | `sheet` |
| `drag-drop/cdk`, `tree/cdk` | 1, 1 | 0 | `drag-drop/engine`, `tree/flat` |
| `i18n-provider` (+ `i18n`) | 101 (+ 51) | 6 (+ 3) | `i18n` |
| `coercion`, `layout`, `observers` | 4, 5, 6 | 1, 1, 1 | internal `utils/*` |

- Win: 148 → ≈ 125 subpaths, one name per task; zero bytes (subpaths are tree-shaken).
- Highest churn: `i18n-provider` (101 files, mostly ui components + examples). Cheapest: overlay internals (1–3 importers each), `drag-drop/cdk`, `tree/cdk`, `preview-trigger/behaviour`.
- Codemod: mechanical import-specifier rewrite; zero-cost baselines (`scripts/zero-cost/packages.txt`) and size report rows rename with it.

## Suggested order for the decision

1. Subpath merges (§5) without the `i18n-provider` move: lowest churn, no API change for app code.
2. Button `variant` × `color` (§3): 37 files, aligns three components.
3. `classes` map (§4): 45 files.
4. `value` / `onChange` for single selection (§2): medium churn, matches HTML + every non-RAC library.
5. `is*` → HTML booleans (§1): largest churn (≈ 700 files), DX only; needs the spread-root attribute filter first.
