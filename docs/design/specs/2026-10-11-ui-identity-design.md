# UI identity: `@rivetjs/ui` + `@rivetjs/cdk` as Rivet's own (2026-10-11)

Lane UI-IDENTITY (design only). Plan: [`../plans/2026-10-11-ui-identity.md`](../plans/2026-10-11-ui-identity.md). Inputs: HERO-AUDIT (scratchpad `perf/HERO-AUDIT.md`, 2026-10-11), `libs/ui/CLAUDE.md`, `libs/ui/styles/{CLAUDE,PATCHES}.md`, `libs/cdk/CLAUDE.md`, `apps/{ui,cdk}-docs/CLAUDE.md`, `libs/cdk/NOTICE`, vendored CSS greps (numbers below are from `libs/ui/styles/components/*.css` at HEAD, Rivet theme: `--radius` 8 px, `--field-radius` 12 px → `--radius-3xl` 24 px).

## 0. User rulings (binding, newest first)

- **R6 (2026-10-11):** no second theme now: brand accent on the HeroUI base only (`rivet` theme).
- **R5 (2026-10-11):** pills (Button, Chip, Tag, Tab) exempt from the inner-radius rule by default; `radius="concentric"` opt-in on those (§3.1).
- **R4 (2026-10-11):** NO mass `is*` boolean prop rename in this wave. "Similar API, improved" = targeted improvements with a measurable DX / bytes win (fewer wrapper layers, live props, compound sugar, controlled / uncontrolled symmetry, forms integration); naming stays RAC-style (`isDisabled`, `selectedKey`, …; memory `cdk-rac-api-decisions`). No codemod; one naming-review task lists candidates with evidence for a later decision (§4.3). cdk module renames (§5) are review candidates too.
- **R3 (2026-10-11, scope correction):** "I do like the heroui design, we just need to tweak it." The look is an **evolution of the vendored HeroUI styles, not a new design system**. Vendored CSS + tokens stay the base. §3 is a **tweak list**: concrete defect fixes (concentric radii, padding scale, icon sizes / stroke, per-component CSS split, defects table §3.6), brand accent / gradient usage, small refinements — each justified against the current HeroUI value with before/after numbers. No wholesale token / typography replacement; no restyle that makes a component unrecognisable. The CSS split is a **refactor of the existing files** (per-component files + cascade layers), visual output **byte-for-byte identical** except the listed tweaks; story-app screenshots prove it.
- **R2 (2026-10-11, addendum):** "paddings and inner border radiuses are not natural, you know the golden rule. Icon sizes are not 'that' size. Styles are one giant chunk instead of per component." + "don't stop there" → hard requirements H1–H5 (§3.1–§3.6).
- **R1 (2026-10-11):** "ui will need to be updated in a way it's not heroUI anymore, and cdk is not react-aria anymore" → clarified "similar look, improved. similar API, improved." Supersedes the strict 1:1 rule (root `CLAUDE.md` cdk rule, `libs/ui/CLAUDE.md` "1:1 API"). Upstream behaviour + ported upstream tests stay the **quality floor**; look tweaks and API become Rivet's own; licences, NOTICE, file headers stay.

## 1. Identity

### 1.1 Names

- Packages unchanged: `@rivetjs/ui` (styled), `@rivetjs/cdk` (headless). No rename: published names, docs origins, MCP data, skills all keyed on them.
- Theme: **`rivet`** (the existing generated `styles/themes/rivet.css`, now the only shipped theme entry). `@rivetjs/ui/styles/heroui.css` + `themes/heroui.css` + the `heroui` half of `themes/scoped.css` are removed (the HeroUI look stays reachable as `CLASSIC_PRESET` (was `HEROUI_PRESET`; renamed by DEBRAND 2026-10-12) in `@rivetjs/ui/theme` / the theme builder; a preset is variables only).
- Positioning line (README, docs home, package descriptions): **"Rivet UI — accessible, resumable components for Rivet: server-rendered, zero JS until you interact, pay per component."** cdk: **"Rivet CDK — headless, accessible building blocks: behaviour, keyboard and focus done right, styled by you."**

### 1.2 "Similar look, improved" (principles)

1. Recognisably the same family as HeroUI v3: soft surfaces, pill buttons, field shells, overlay shadows, `--accent` tokens. Fixes, not a redesign (R3).
2. Geometry is derived, not hand-picked: inner radius = outer − padding (§3.1), one spacing scale (§3.2), icon box = f(font size) (§3.3).
3. Pay per component: CSS ships with the component that uses it (§3.4); zero-cost extends to CSS.
4. Brand accent everywhere the accent is used (already: `oklch(0.52 0.24 264)`); the logo gradient only on brand surfaces (focus is never a gradient).
5. Every tweak carries a number: before (HeroUI value) → after, contrast where colour changes.
6. Light + dark parity: every state readable in both (WCAG 2.2 AA + APCA Lc check, §3.6).
7. Touch is first-class: ≥ 44 px hit area on `pointer: coarse` without changing the visual size.

### 1.3 "Similar API, improved" (principles, R4)

1. Signal-first: every value / open / selection prop takes `T | Signal<T>`; a Signal is two-way (cdk `controllable`).
2. Live props everywhere (every prop live unless justified + documented: memory "Live props default live").
3. Names unchanged (RAC-style); renames only after the naming review (plan T10) and a user decision.
4. Fewer wrapper layers: structural wrappers that carry no user choice collapse into their parent (Modal Backdrop/Container/Dialog → `Modal.Content`; Tabs ListContainer; Table ScrollContainer/Content; Popover Content/Dialog; Dropdown Popover/Menu). Explicit parts stay exported for custom layouts.
5. Compound sugar where it removes boilerplate: `label` / `description` / `errorMessage` on fields; `items` + render function on collections; automatic indicators (Select chevron, ListBox check, Tabs indicator) unless the part is given.
6. Controlled / uncontrolled symmetry on every component (Signal, value + handler, `default*`, resumed).
7. Forms: every field joins `@rivetjs/forms` by `name` inside `<Form form={…}>` (value, issues → FieldError, `isInvalid`, focus first invalid) with zero glue.
8. Every change states its win: lines / JSX nodes per example, DOM nodes, bytes.

### 1.4 Kept from upstream (quality floor, never traded)

- Behaviour: React Aria / Stately / RAC / Angular CDK / embla / YARL / Radix / react-resizable-panels semantics: roles, ARIA wiring, keyboard maps, typeahead, focus management (FocusScope, restore, virtual focus), press / hover / long-press / move normalisation, interact-outside, scroll lock, `aria-hidden` outside, live announcements, i18n (`@internationalized/date`, number parsing, RTL), collection model (keys, sections, disabled keys, selection modes), drag-drop.
- Edge cases: IME composition, Android virtual keyboard, iOS VoiceOver press, Safari focus quirks, `inert`, nested overlays, touch cancellation.
- Ported upstream test suites (cdk, ui-components): kept; on a rename they are mechanically rewritten (same assertions, new prop names); count of test cases per suite pinned before/after (§7.3).
- Licences: Apache-2.0 / MIT file headers `// Ported from … ` (+ `Rivet:` / `Changes:` bullets) stay on every derived file; `libs/cdk/NOTICE`, `libs/ui/NOTICE` stay complete; each docs site gets a "Credits & licences" page.

## 2. Positioning vs today

| | Today | After |
| --- | --- | --- |
| ui | "1:1 port of HeroUI v3.2.6", vendored `@heroui/styles` byte-comparable, PATCHES.md gate | Rivet UI on a forked HeroUI style base (RAC-style API, targeted improvements); tweaks listed in `styles/TWEAKS.md` (§3.7) |
| cdk | "1:1 ports of React Aria / RAC / Angular CDK", docs mirror upstream pages | Rivet CDK: docs by task, upstream = internal provenance; module renames = review candidates (§5) |
| docs | upstream-mirrored IA, drift test vs heroui.com sections | own IA + coverage tests against our own section manifest (§6) |

## 3. Look — tweak list on the HeroUI base (R2 + R3)

### 3.1 H1 Concentric radii (the golden rule)

- Rule: a rounded-rect child inset by `p` from a rounded parent of radius `R` has radius `max(R − p, 0)`; never equal or larger. Shape-exempt by default (R5): pills (radius ≥ height / 2: Button, Chip, Tag, Tab, calendar cell) — a pill reads concentric-neutral and is the HeroUI signature. Opt-in `radius="concentric"` on Button / Chip / Tag / Tabs sets `border-radius: var(--r-inner)` (`data-radius="concentric"`) so a control in a padded parent's corner follows the rule. Border counts as padding (1 px shell → inner −1 px).
- Token scheme (in the fork's `themes/shared/theme.css`, per component on its root block):
  - `--r-outer` (component radius), `--pad` (inset of the nested content), `--r-inner: max(0px, calc(var(--r-outer) - var(--pad)))`.
  - Nested items read the parent's `--r-inner` (inherit through the cascade): `.list-box__item { border-radius: var(--r-inner, var(--radius-2xl)) }`. A nested container re-declares `--r-outer: var(--r-inner)` so depth composes (popover → menu → item).
- Current defects (Rivet theme numbers):

| Nest | Outer R | Inset | Concentric | Today | Fix |
| --- | --: | --: | --: | --: | --- |
| Dropdown popover → menu → item (`dropdown.css:54/117/126`, `menu-item` `rounded-2xl`) | 24 | 6 + 4 = 10 | 14 | 16 | item `--r-inner` → 14 |
| Select popover → list-box → item (`select.css:188/252`, `list-box.css:7`, `list-box-item` `rounded-2xl`) | 24 | 6 + 4 | 14 | 16 | same |
| ComboBox / Autocomplete popover → list-box → item | 24 | 10 | 14 | 16 | same |
| Popover dialog → nested rect (`popover.css:7/65` p-4) | 24 | 16 | 8 | 16–24 (Card / Surface / ColorArea inside) | `--r-inner` 8 on nested surfaces |
| Card → media / inner Surface (`card.css:6/8` p-4) | 24 | 16 | 8 | 0 (image square) or 24 (nested Surface) | `.card` sets `--r-inner`; Card media + nested surface use it |
| Modal dialog → nested Card / Surface (`modal.css:181/182` p-6) | 24 | 24 | 0 → floor 4 | 24 | nested surfaces 4 (floor `--r-min: var(--radius-xs)`) |
| Color picker popover → ColorArea (`color-picker.css:55` R 20, `color-area` `rounded-2xl`) | 20 | 8 | 12 | 16 | ColorArea `--r-inner` |
| Date picker popover → calendar (`date-picker.css:48` R 20, p-3) | 20 | 12 | 8 | year-picker grid cells 16 (`calendar.css:84` `rounded-2xl`) | cells non-pill → 8 |
| Input group shell → prefix / suffix addon (`input-group.css:116/142` `rounded-s-field`) | 12 | 1 (border) | 11 | 12 | addons `--r-inner` |
| Number / search field shell → steppers / clear (`number-field`, `search-field` `rounded-field`) | 12 | 1 | 11 | 12 | same |
| Segment track → thumb (`segment.css:17/56`, p-1) | 20 | 4 | 16 | 16 | OK (Rivet-authored, reference) |
| Tabs list → tab (both `rounded-3xl`, pills by clamp) | pill | — | — | pill | exempt; vertical list (taller than 48 px) gets explicit pill `9999px` so it never falls back to 24 |
| Accordion surface variant (`accordion.css:134` R 24, `px-4`) → item focus ring inset | 24 | 16 | 8 | 4 (`rounded-xs`) | 8 |

- Focus ring: `focus-ring` = `ring-2` (box-shadow) + 2 px offset → box-shadow spread grows the radius by the spread, so rings are already concentric (verified; keep). Field ring offset 0 → same radius (correct).

### 3.2 H2 Padding / spacing scale

- Today: paddings use Tailwind's linear 4-px grid with half steps — values in use 2, 4, 6, 8, 10, 12, 16, 24, 40 px; horizontal:vertical ratios drift 1.33 → 4.
- Scale (4-pt base, ratio ≈ 1.5): `--space-1` 4 · `-2` 6 · `-3` 8 · `-4` 12 · `-5` 16 · `-6` 24 · `-7` 36 · `-8` 52. Every padding / gap in component CSS maps to a step (the nearest HeroUI value is usually already a step: 4, 8, 12, 16, 24 stay; 2 → 0 or 4, 10 → 8 or 12, 40 → 36).
- Control padding ratio (horizontal : vertical inset of the text box), per size: **sm 2 : 1, md 2 : 1, lg 2.25 : 1** for pill controls; **1.5 : 1** for rectangular fields; list items **1.33 : 1** (dense rows).

| Component (size md) | Today (px, x / y) | Ratio | After | Ratio |
| --- | --- | --: | --- | --: |
| Button (`h-9`, `px-4`, text 14/20) | 16 / 8 | 2 | 16 / 8 | 2 (keep) |
| Button sm (`h-8`, `px-3`) | 12 / 6 | 2 | 12 / 6 | 2 (keep) |
| Button lg (`h-10` desktop, `px-4`?) | 16 / 10 | 1.6 | 20 / 10 (`px-5`) | 2 |
| Input / TextArea / Select trigger (`px-3 py-2`) | 12 / 8 | 1.5 | 12 / 8 | 1.5 (keep) |
| ListBox / Menu item (`px-2 py-1.5`) | 8 / 6 | 1.33 | 8 / 6 | 1.33 (keep) |
| Chip md (`px-2 py-0.5`) | 8 / 2 | 4 | 8 / 4 (`h` unchanged via leading 16) | 2 |
| Tag (`px-2 py-0.5` / `px-2.5 py-1`) | 8 / 2, 10 / 4 | 4, 2.5 | 8 / 4, 12 / 6 | 2 |
| Alert / Toast (`px-4 py-3`) | 16 / 12 | 1.33 | 16 / 12 | 1.33 (keep: block, not a control) |
| Kbd (`px-2`, `h-6`) | 8 / 4 | 2 | 6 / 4 | 1.5 (rect) |
| Modal (`p-6`, mobile `p-4`, container `sm:p-10`) | 24 / 16 / 40 | — | 24 / 16 / 36 | scale steps |

- Hit targets: Button visual `h-9` (36) desktop / `h-10` (40) mobile, checkbox 16, radio 16, toast close 20 (`toast.css:232`), tag remove 12 + `touch-target`. Rule: `@media (pointer: coarse)` every interactive part gets a ≥ 44 × 44 hit area via the existing `touch-target` utility (pseudo-element), visual size unchanged; WCAG 2.2 target-size minimum 24 × 24 on fine pointers (toast close 20 → 24).
- Density: `data-density="compact | comfortable"` on any ancestor shifts control height and padding one scale step (compact: md 36 → 32, x 16 → 12); default = today's sizes. No third density.

### 3.3 H3 Icon sizes + stroke

- Rule: icon box = font size × 1.143 rounded to the optical set **16 / 20 / 24** (12 / 14 only inside 12-px chips and indicators); `flex: none`, `width = height`, no negative margins; stroke width per optical size: 16 → 2 (lucide default), 20 → 1.75, 24 → 1.5, 12–14 → 2 with `absoluteStrokeWidth`.
- Mapping: text 12 → 14 box (chips / tags / kbd) · text 14 → 16 · text 16 → 20 · display 18+ → 24.
- Current defects:

| Slot | Today | Problem | After |
| --- | --- | --- | --- |
| Button svg (`button.css:67`) | 20 on mobile (text 16), 16 ≥ sm (text 14), `-mx-0.5 my-0.5 sm:my-1` | negative margins shift text 2 px; size flips at `sm` while text flips at `md` | 16 at text 14 / 20 at text 16, same breakpoint as text, no margins |
| Button icon-only (`button.css:75`) | 16 in a 36 / 40 box | OK | keep |
| Menu item submenu chevron (`menu-item.css:32`) | 14 | below text 14 optical 16 | 16 |
| Menu item selection check (`menu-item.css:119/131`) | 10 / 8 | illegible, stroke 2 at 8 px = 25 % of box | 14 (`absoluteStrokeWidth`) |
| Menu item leading icon (`menu-item.css:151`) | 12 | text 14 | 16 |
| ListBox item indicator (`list-box-item` `size-2.5`) | 10 | same as menu | 14 |
| Tag svg / remove (`tag.css:28/103`) | 12 | text 12 → 14 | 14 |
| Toast close (`toast.css:244`) | 14 / 12 (`sm:size-3`) in a 20 box | shrinks on desktop | 14 in a 24 box |
| Search field clear (`search-field.css:139`) | 12 in 20 | text 14 | 14 in 24 |
| Select indicator (`select.css:130`) | 16 in a 20 box `p-1` | box larger than icon, off-centre by padding | 16 box, no padding |
| Alert / Toast status icon (`alert.css:19`, `toast.css:196`) | 16 `box-content` + `p-1` | line height 24 → OK | 16, `flex: none`, align to first line (`margin-block: calc((1lh - 16px) / 2)`) |
| Accordion indicator (`accordion.css:24`) | 16 | OK | keep |
| Stroke everywhere | kit `Icon` default 2 | heavy at 20 / 24 | per-size stroke via `--icon-stroke` on the slot (`Icon` reads `stroke-width: var(--icon-stroke, 2)`) |

- Implementation: one shared rule set `[data-slot="icon"]` / `.icon` in base (`--icon-size`, `--icon-stroke`), components set the two variables per size; ui parts render lucide through `@rivetjs/kit/icon` (`Icon` passes `stroke-width` as CSS when unset). Lucide only (HIGH PRIORITY rule).

### 3.4 H4 Styles per component, not one chunk

- Today: `@import "@rivetjs/ui/styles"` = Tailwind + `tw-animate-css` + all 127 component files (475 KB source CSS). Every built page ships the whole kit: `templates/starter-ui` CSS **717,517 B minified / 68.8 KB gzip**; every `apps/ui-docs` example frame ≈ **719 KB / 51.7 KB brotli** (`showcase-kanban-*.css`), whatever it uses.
- Decision: **refactor the fork in place** (R3), not rewrite:
  1. `libs/ui/styles/` stays the source (BEM classes, tv definitions, Tailwind `@apply`), now owned (PATCHES.md + verbatim re-diff retired → `TWEAKS.md`, §3.7).
  2. Package build (`scripts/package/build.ts` hook, new `libs/ui/scripts/build-css.ts`) compiles each `components/<name>.css` with Tailwind v4 against the shared theme (`@reference`) into **plain CSS** `dist/libs/ui/styles/components/<name>.css` in `@layer rivet.components`; `base.css` (tokens + base + scrollbar + the shared icon / focus utilities) in `@layer rivet.base`. Consumers no longer need Tailwind for ui (Tailwind stays optional for app code).
  3. Each `src/components/<name>/index.ts` gets a side-effect `import "../../../styles/out/<name>.css"` of its own compiled file + the files of the ui components it renders (Button inside Modal footer is the user's, not Modal's). CSS-only dependency graph = JS import graph → an app pays for the components it imports (zero-cost for CSS).
  4. Layer order (declared once in `base.css`): `@layer rivet.base, rivet.components, rivet.utilities, app;` — app CSS outside layers or in `app` always wins; Tailwind v4 apps put `@layer theme, base, rivet, components, utilities` (same pattern as cdk `tailwind.css`).
  5. `@rivetjs/ui/styles` (all-in-one, compiled) stays for CDN / no-bundler use; `@rivetjs/ui/styles/base.css` + `@rivetjs/ui/styles/<name>.css` explicit entries for manual setups.
  6. Visual identity check: the compiled per-component output is diffed against today's single bundle per selector (`styles-split.test.ts`: union of split files = old bundle rules, modulo order inside layers) before any tweak lands.
- Needs a spike (plan T2): Rivet router SSR must emit `<link>`s for CSS imported by `.tsx` source packages on server-rendered + resumed pages (devtools and cdk tests already import `.css` from TS; verify manifest → `<link>` on first paint, no FOUC, dedupe across chunks, CSP).
- Target: page using Button + TextField + Modal ≤ 40 KB minified CSS (today 717 KB); docs-site frame CSS drops to the components the example imports.

### 3.5 Brand accent + gradient usage, dark mode

- Accent unchanged: `oklch(0.52 0.24 264)` (Rivet preset; white text AA incl. hover mix — `tests/theme.test.ts` 21 pairs). Danger stays the deeper `oklch(0.56 0.215 26)`.
- Neutral hue bias: keep `base` 0.005 at hue 264 (today). Shadows tinted: `rgba(0,0,0,…)` → `oklch(0.25 0.02 264 / α)` same α (`variables.css:181–190`), invisible luminance change, cooler tone matching the neutral.
- Gradient (`--rivet-*`, logo palette cyan #01EEF9 → … → pink #F930BF) only on: brand surfaces (landing hero, `Button variant="brand"` new opt-in variant value, progress / meter `color="brand"`, chart series palette `--chart-1…7` = the 7 logo stops lightness-adjusted for ≥ 3 : 1 against surface). Never for focus, text, or state colours.
- Dark mode: default follows `prefers-color-scheme` (`<ThemeScript>` from kit, `data-theme="system"` default); explicit `data-theme` wins; no flash (pre-paint script). Dark surfaces: today `--surface-shadow` none in dark (`variables.css:256`) → elevated surfaces rely on lightness only; tweak: 1 px `--border` hairline at 8 % white on overlays + cards in dark (separation measured ΔL ≥ 0.04).

### 3.6 H5 Visual audit — defects table (the "don't stop there" pass)

Numbers from the vendored CSS + Rivet theme; contrast via `@rivetjs/ui/theme` `auditContrast` (WCAG 2.x) + new APCA Lc column (plan T6).

| Area / component | Defect (today) | Fix (after) |
| --- | --- | --- |
| Concentric radii (12 nests) | §3.1 table | `--r-outer` / `--pad` / `--r-inner` tokens |
| Padding ratios | Chip 4 : 1, Tag 4 : 1 / 2.5 : 1, Button lg 1.6 : 1 | §3.2 ratios |
| Spacing values | 2 / 6 / 10 / 40 px off-scale (`p-[3px]` modal, `gap-0.5`, `px-2.5`, `sm:p-10`) | scale steps |
| Icons | §3.3 table (10 slots) | optical sizes + stroke per size |
| CSS delivery | 717 KB per page | per-component CSS ≤ 40 KB for 3 components |
| Hit targets | 36 / 40 px buttons, 16 px checkbox / radio, 20 px toast close, mobile | `touch-target` on coarse pointers ≥ 44, fine ≥ 24 |
| Type scale / line height | Tailwind default 12/16, 14/20, 16/24; Card title `leading-6` at 14 px vs description `leading-5` (`card.css`) | keep scale (R3); card title/description rhythm 20/20 at 14 px, 4 px gap |
| Field anatomy rhythm | Label → field gap 4 (`select.css:4` `gap-1`), field → description/error gap 4, TextField vs Select vs DatePicker differ (`date-picker` `gap` via Field) | one rule: label ↓ 6, description / error ↓ 4, group gap 16; `--field-gap-*` tokens |
| Focus rings | 2 px ring + 2 px offset on controls, 0 offset on fields; dark ring colour = accent L 0.52 on dark surface → < 3 : 1 against `--background` dark | ring colour `--focus` raised to L 0.68 in dark (≥ 3 : 1 vs surface + vs control) |
| Disabled state | `opacity: 0.5` everywhere (`--disabled-opacity`), text on muted reaches ≈ 2.2 : 1 (allowed for disabled, but disabled-vs-enabled ΔL inconsistent between soft / solid buttons) | keep 0.5 (HeroUI look), add `cursor: var(--cursor-disabled)` uniformly (missing on list items, tabs) |
| Hover / press | Button bg 100 ms, transform 250 ms `ease` (`--ease-smooth = ease`), press scale only on Button + Tabs; list items hover without press feedback | press `scale(0.97)` on pill controls only; durations 150 ms colour / 200 ms transform; `--ease-smooth` → `cubic-bezier(0.2, 0, 0, 1)` |
| Motion durations | spread 100 / 150 / 200 / 250 / 300 ms + `tw-animate-css` defaults; overlays `slide-in-from-top-1` | tokens `--duration-fast 120`, `-base 180`, `-slow 260`; overlay enter 180 / exit 120; `@rivetjs/motion` (spec `2026-10-11-motion-design.md`, awaiting GO) reads the same tokens as its default `transition` when it lands |
| Shadows | 3 stacked black `rgba` layers per elevation, dark mode none | hue-tinted (§3.5); dark: hairline border |
| Borders vs surfaces (dark) | Card / Popover separated only by ΔL ≈ 0.02 in dark | hairline 8 % white |
| Empty / loading | EmptyState one size; Skeleton `shimmer` vs Spinner sizes 16 / 20 / 24 unrelated to control sizes | Spinner = icon size of the host control; EmptyState sizes sm / md / lg (Pro gap, §6) |
| RTL | logical props mostly; `left-1/2` / `-translate-x-1/2` in `calendar.css:271`, tabs indicator `left-1/2`, `start-[5%]` OK | audit all physical `left`/`right` / `translate-x` (grep) → logical or `rtl:` mirrored; story app RTL screenshots |
| Contrast | 21 WCAG pairs pass AA; no APCA; muted text `--muted` on `--surface-secondary` not in the pair list | add 9 pairs (muted on every surface level, placeholder on field, focus vs surface, chart series vs surface), APCA Lc ≥ 60 body / 45 large / 30 non-text |

### 3.7 Tweak bookkeeping

- `libs/ui/styles/TWEAKS.md` replaces `PATCHES.md`: one row per tweak (id `TW-nn`, file, before → after numbers, reason, screenshot ids). Existing PATCHES rows move over as `TW-00x` (button-group / avatar-group `:nth-child(1 of …)`, overlay close-trigger anchor, tv import, Rivet-authored component files).
- File headers stay `/* Ported from HeroUI v3.2.6 packages/styles/… (Apache-2.0, © 2025 NextUI Inc.). */` + `/* Rivet: modified, see TWEAKS.md */` (Apache-2.0 §4b).
- Re-diff against upstream retired; no upstream tracking (already "no tracking", `UPSTREAM` stays as provenance).

## 4. API improvements (R4: targeted, measurable; RAC naming kept)

### 4.1 Conventions (ui + cdk)

| Topic | Rule |
| --- | --- |
| Naming | RAC-style, unchanged (memory `cdk-rac-api-decisions`): `isDisabled`, `isRequired`, `isReadOnly`, `isInvalid`, `isOpen` / `defaultOpen` / `onOpenChange`, `selectedKey(s)` / `defaultSelectedKey(s)` / `onSelectionChange`, item `id`, `textValue`, `variant` values as today. Candidates for a later decision only: plan T10 "naming review". |
| Signals | every value / open / selection prop takes `T \| Signal<T>`; a Signal is two-way (cdk `controllable`); same for every component (symmetry test) |
| Live props | every prop live unless justified + documented |
| Wrapper layers | parts that only forward to the next part (no own choice) fold into their parent; explicit parts stay exported for custom layouts |
| Compound sugar | shorthand props (`label`, `description`, `errorMessage`, `title`) and automatic parts (Select trigger value + chevron, ListBox check, Tabs indicator, Modal close button) when the part is not given; `items` + render function on collections |
| Styling | unchanged: `class` (no `className`), `data-slot`; `classes` map = naming-review candidate |
| Forms | `name` joins the enclosing `@rivetjs/forms` form (`<Form form={…}>`): value, issues → FieldError, `isInvalid`, focus first invalid; without a form, `validate` / constraint validation as today |
| Resume | each component page states its tier: **R0** static (no JS ever: Card, Badge, Kbd, Typography), **R1** inert until first interaction (default: Button, fields, overlays, collections), **R2** visible-preload (Sidebar, Carousel, Stepper root); tests assert no `data-boot` at load for R0 / R1 |
| Radius | pills exempt from the concentric rule; `radius="concentric"` opt-in on Button, Chip, Tag, Tabs (R5, §3.1) |

Measurable win per change (stated in each task commit): JSX nodes / lines per example (before → after, docs examples), DOM nodes per instance, JS + CSS bytes per component (`ui-components.mjs`), resume state bytes.

### 4.2 Changes — 10 most used components (breaking where parts fold; names unchanged)

1. **Button** — no structural change; `radius="concentric"` opt-in (R5); `isPending` spinner sized from the icon slot (§3.3).

```tsx
// before
<Button variant="danger-soft" isDisabled={busy()} onPress={save}><Icon icon={Trash2} />Delete</Button>
// after (same API; icon box + stroke now follow the size)
<Button variant="danger-soft" isDisabled={busy()} onPress={save}><Icon icon={Trash2} />Delete</Button>
```

2. **TextField / Input**

```tsx
// before
<TextField name="email" type="email" isRequired>
  <Label>Email</Label>
  <Input placeholder="you@example.com" />
  <FieldError />
</TextField>
// after (shorthand; compound parts still accepted for custom layouts)
<TextField name="email" type="email" isRequired label="Email" placeholder="you@example.com" />
```

3. **Select**

```tsx
// before
<Select placeholder="Select one" selectedKey={state} onSelectionChange={(k) => state.set(k)}>
  <Label>State</Label>
  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="fl" textValue="Florida">Florida<ListBox.ItemIndicator /></ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>
// after (Signal two-way; auto trigger + popover + indicator; textValue from string children)
<Select label="State" placeholder="Select one" selectedKey={state}>
  <Select.Item id="fl">Florida</Select.Item>
</Select>
```

4. **Modal**

```tsx
// before
<Modal>
  <Button>Open</Button>
  <Modal.Backdrop><Modal.Container><Modal.Dialog>
    <Modal.CloseTrigger />
    <Modal.Header><Modal.Heading>Welcome</Modal.Heading></Modal.Header>
    <Modal.Body>…</Modal.Body>
    <Modal.Footer><Button slot="close">Continue</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
</Modal>
// after (Content = Backdrop + Container + Dialog; close button on by default, closeButton={false} hides it)
<Modal isOpen={open}>
  <Button>Open</Button>
  <Modal.Content size="sm" backdrop="blur">
    <Modal.Header>Welcome</Modal.Header>
    <Modal.Body>…</Modal.Body>
    <Modal.Footer><Button slot="close">Continue</Button></Modal.Footer>
  </Modal.Content>
</Modal>
```

5. **Drawer** — same fold as Modal; `placement` moves to the root.

```tsx
// before
<Drawer><Button>Open</Button><Drawer.Backdrop><Drawer.Content placement="right"><Drawer.Dialog>…</Drawer.Dialog></Drawer.Content></Drawer.Backdrop></Drawer>
// after
<Drawer placement="right"><Button>Open</Button><Drawer.Content>…</Drawer.Content></Drawer>
```

As built (T15): the explicit sliding part (HeroUI's `Drawer.Content`) is `Drawer.Container`, same class / `data-slot`.

6. **Tabs**

```tsx
// before
<Tabs selectedKey={tab} onSelectionChange={(k) => tab.set(k)}>
  <Tabs.ListContainer><Tabs.List aria-label="Options">
    <Tabs.Tab id="overview">Overview<Tabs.Indicator /></Tabs.Tab>
  </Tabs.List></Tabs.ListContainer>
  <Tabs.Panel id="overview">{() => <p>…</p>}</Tabs.Panel>
</Tabs>
// after (ListContainer folded, indicator automatic; panel function children stay the resumable form)
<Tabs selectedKey={tab}>
  <Tabs.List aria-label="Options"><Tabs.Tab id="overview">Overview</Tabs.Tab></Tabs.List>
  <Tabs.Panel id="overview">{() => <p>…</p>}</Tabs.Panel>
</Tabs>
```

7. **Table**

```tsx
// before
<Table><Table.ScrollContainer><Table.Content aria-label="Team" selectionMode="multiple" selectedKeys={sel} onSelectionChange={(k) => sel.set(k)}>
  <Table.Header><Table.Column isRowHeader>Name</Table.Column></Table.Header>
  <Table.Body><Table.Row id="kate"><Table.Cell>Kate</Table.Cell></Table.Row></Table.Body>
</Table.Content></Table.ScrollContainer></Table>
// after (root = ScrollContainer + Content; compound form stays; data-driven form added)
<Table aria-label="Team" selectionMode="multiple" selectedKeys={sel} columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={people}>
  {(row) => <Table.Row id={row.id}>{(col) => <Table.Cell>{row[col.id]}</Table.Cell>}</Table.Row>}
</Table>
```

8. **Menu / Dropdown**

```tsx
// before
<Dropdown><Button>Actions</Button><Dropdown.Popover><Dropdown.Menu onAction={(k) => run(k)}>
  <Dropdown.Item id="delete" textValue="Delete" variant="danger"><Label>Delete</Label></Dropdown.Item>
</Dropdown.Menu></Dropdown.Popover></Dropdown>
// after (Menu renders its popover; string children → Label + textValue; icon / shortcut sugar)
<Dropdown>
  <Button>Actions</Button>
  <Dropdown.Menu onAction={(k) => run(k)}><Dropdown.Item id="delete" variant="danger" icon={Trash2} shortcut="⌘⌫">Delete</Dropdown.Item></Dropdown.Menu>
</Dropdown>
```

(`shortcut` is text in a `Kbd`, not an icon.)

9. **Popover**

```tsx
// before
<Popover><Button>Info</Button><Popover.Content class="max-w-64"><Popover.Dialog><Popover.Heading>Title</Popover.Heading>…</Popover.Dialog></Popover.Content></Popover>
// after (Content = Content + Dialog; title → Heading)
<Popover><Button>Info</Button><Popover.Content class="max-w-64" title="Title">…</Popover.Content></Popover>
```

10. **Form** (with `@rivetjs/forms`)

```tsx
// before: per-field validate callbacks + manual FormData
<Form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget as HTMLFormElement); … }}>
  <TextField name="email" isRequired validate={(v) => (/@/.test(v) ? null : "Invalid")}><Label>Email</Label><Input /><FieldError /></TextField>
</Form>
// after: schema-driven, fields bind by name (value, issues, isInvalid, focus-first-invalid)
const form = createForm({ schema: Signup, onSubmit: (data) => save(data) });
<Form form={form}>
  <TextField name="email" label="Email" />
  <Button type="submit" isPending={form.submitting()}>Sign up</Button>
</Form>
```

### 4.3 Other API items

- Fewer wrappers audit (all 81): every part that only forwards to the next part with no own prop is folded (list per batch in plan T21–T26).
- Controlled / uncontrolled symmetry test: per component Signal, plain value + handler, `default*`, all three resumed (shared harness `tests-components/controlled.test.ts`).
- SSR / resume guarantee per component: tier (§4.1) + "first interaction chunks" list on each docs page, generated from the build (resume state `needs`) rather than hand-written.
- `rac` root re-exports + root hooks gap (HERO-AUDIT §1): `useListData`, `useMediaQuery`, `useTheme`, `useCSSVariable` exported; `Virtualizer`, `I18nProvider`, `RouterProvider` re-exported from cdk.
- Naming review (plan T10, no code): candidates with evidence (grep counts, consumer churn, HTML / Solid / Svelte precedent, DX examples) — `is*` booleans → HTML names, `selectedKey(s)` → `value`, `variant="danger-soft"` → `variant` × `tone`, cdk `<part>Class` → `classes`, cdk module subpaths (§5) — for a later user decision.

## 5. cdk

- Framing: "Rivet CDK" (§1.1). Upstream = provenance in file headers + NOTICE + per-page "Credits" footnote, not identity. Root `CLAUDE.md` cdk rule rewritten: "behaviour and ported tests are the floor (React Aria / Angular CDK / …); names, docs and API conventions are Rivet's".
- Module naming candidates (R4: review only, plan T10; no rename in this wave). Awkward / duplicated subpaths → one task-named module:

| Today | After |
| --- | --- |
| `announcer`, `live-announcer`, `a11y/live-announcer` | `announcer` (one module, both APIs) |
| `bidi`, `bidi-dir` | `direction` |
| `focus`, `focus-scope`, `focus-ring`, `a11y/focus-monitor`, `a11y/focus-trap` | `focus` (+ `focus/scope`, `focus/ring`, `focus/monitor`, `focus/trap`) |
| `overlay-*` (13 Angular CDK internals: `overlay-position-builder`, `overlay-service`, `overlay-dispatchers`, `overlay-strategy`, `overlay-ref`, `overlay-container`, `global-position`, `connected-position`, `scroll-strategies`, …) | `overlay` (public) + `overlay/position`, `overlay/scroll`, `overlay/service` |
| `preview-trigger/behaviour` | `hover-card` |
| `sheet-motion` | `sheet` |
| `drag-drop/cdk`, `tree/cdk` | `drag-drop/engine`, `tree/flat` (names by role; decided after the review) |
| `i18n-provider` | `i18n` |
| `coercion`, `observers`, `layout` (Angular utils) | internal (`utils/*`), not exported |
| `*/behaviour` | kept (headless hooks layer; doc'd as "behaviour") |

- Stays 1:1 internally: state machines, collection builders, keyboard delegates, overlay positioning maths, drag-drop engine, date / number maths, ported tests. Component part names and props stay RAC-style (`ListBox`, `GridList`, `Calendar`, `isDisabled`, `selectedKey`); §4.1 improvements (Signals, symmetry, live props) apply.
- Docs (`apps/cdk-docs`) by task, not by upstream package: Start (install, styling headless parts, resumability) → Build (forms fields, selection & collections, overlays & positioning, menus & pickers, dates & numbers, drag & drop, virtualization, motion, focus & keyboard, i18n & RTL) → Components reference (A–Z) → Primitives (behaviour hooks, state, utils).
- Tests: no upstream-mirror test in cdk-docs today; new `apps/cdk-docs/tests/coverage.test.ts`: every public export documented (`::api` or table), every component page has the template sections (§6.2), every example has ≥ 1 behaviour step.

## 6. Docs

### 6.1 IA

- ui-docs: Get started (introduction, installation (per-component CSS), theming, dark mode, styling, forms, resumability, migration (folded parts, before / after)) → Components by task (Actions, Text input, Selection, Pickers, Date & time, Color, Overlays, Navigation, Feedback, Data display, Charts, Layout, AI) → Patterns (form with schema, data table, dashboard shell, command palette, settings page) → Showcase → Theme builder → Credits.
- Page template (both sites): intro + hero example · Usage · Anatomy (parts + `data-slot`) · Examples by task · Props (`::api`, generated) · Styling (tokens, `data-slot`, CSS variables, tweaks) · Accessibility (roles, keyboard table) · Resumability (tier, first-interaction chunks) · Related.
- Example style: own content (no "HeroUI" strings in demo text, e.g. modal-default "Welcome to HeroUI" → Rivet copy), lucide icons, Tailwind for layout only, every example has steps.

### 6.2 Coverage tests replace drift tests

- `apps/ui-docs/tests/upstream-sections.json` + `sections.test.ts` (drift vs heroui.com mdx, 6,978 lines) → `tests/sections.json` (our required sections per page) + `coverage.test.ts`: template sections present, every `@rivetjs/ui/<name>` subpath has a page, every part exported by the subpath appears in Anatomy, every page lists its resume tier.
- 684 upstream demos stay as examples (they test behaviour); renamed ids drop nothing; examples whose only value was upstream parity can be merged by task (plan T31 showcase / examples, no deletion below one example per section).

### 6.3 Wording sweep

- Remove "port of", "1:1", "upstream", "HeroUI", "React Aria", "RAC" as identity wording from: `README.md`, root + every `CLAUDE.md` under `libs/ui`, `libs/cdk`, `apps/ui-docs`, `apps/cdk-docs`, `apps/docs/content/**`, `apps/{ui,cdk}-docs/content/**`, `libs/mcp/ai/**` (→ regenerated starter AGENTS.md / CLAUDE.md / skills / Cursor / Copilot via `node libs/mcp/ai/sync.ts`), `skills/**`, `templates/**`, `libs/create-rivet` output, package.json `description`s, JSDoc headers in `index.ts` barrels, `docs/guides/**`; llms.txt / llms-full.txt / per-page `.md` regenerated (`node libs/docs-kit/cli.ts llms <app>`), MCP data (`node libs/mcp/build-data.ts`).
- Grep baseline (md only, 2026-10-11): "port of" 157 files, "HeroUI" 224, "React Aria" 193, "upstream" 250, "1:1 port" 16. Allowed residue: NOTICE / LICENSE files, file headers `Ported from …`, Credits pages, `docs/design/**` (historical records), `UPSTREAM` pin. Gate = `scripts/check-identity-wording.ts` (allow-list paths) in CI `gates`.
- Homepage spec (`2026-10-11-homepage-design.md` §facts) says "Every component is a faithful port" → reword to "upstream-grade behaviour, keyboard and screen-reader support, ported test suites included" when the homepage is built.
- Showcase examples (`apps/ui-docs/examples/showcase-*`) re-shot on the tweaked look; the landing page (`2026-10-11-homepage-design.md`, T1 / T8) consumes `@rivetjs/ui` after T11–T20.

## 7. Pro-catalogue gaps → "our" components (clean-room)

- Clean-room rule unchanged: public section / demo names + public anatomy lists only; own implementation, CSS, content, data; no Pro source; lucide only. The `:::note "inspired by HeroUI Pro's public docs"` wording becomes a Credits-page line (identity sweep) — the components are ours.
- Fold-in (HERO-AUDIT §2 / §4 lanes, on the new API conventions from the start):
  - Partials (18): charts split into area / bar / line / pie / tooltip pages + series features; kpi + kpi-group; rating; trend-chip; empty-state sizes / variants; stepper / app-layout / sidebar / resizable / carousel missing sections; chain-of-thought / prompt-input / data-grid single sections.
  - S (10): cell-switch, cell-color-picker, number-value, emoji-reaction-button, item-card, item-card-group, timeline, hover-card, widget, list-view.
  - M (10): context-menu, command, drop-zone, file-tree, floating-toc, pressable-feedback (closes `button-ripple-effect`), holo-card, radar-chart, radial-chart, composed-chart.
- **Pro-L decisions (user, 2026-10-11):** kanban — already exists as the `showcase-kanban` example (cdk drag-drop + ui parts); Project Board covered, Notion Board + Sizes missing and no `@rivetjs/ui/kanban` component → normal Pro task (plan T40). Agenda — yes, ported from the user's malva scheduler in a separate AGENDA lane (spec `2026-10-12-scheduler-design.md`), not part of this plan. Emoji picker — no. Rich text editor — not now. Map — no.

## 8. Risks + measurement

### 8.1 Risks

1. **Wrapper folds break consumers** (§4.2): 988 ui-docs + 635 cdk-docs examples, showcase, templates and tests use the explicit parts; folded structure changes DOM nesting that app CSS may target. Mitigation: explicit parts stay exported (folds are additive defaults), examples migrated per component task, screenshots identical for the explicit form; mass prop renames deferred (R4), so no codemod churn.
2. **CSS split regressions** (§3.4): cascade order inside layers, rules shared across components (`.button` inside `button-group`, `toggle-button`, `close-button`), Tailwind `@apply` of shared utilities duplicated per file (bytes), SSR `<link>` emission for source-package CSS. Mitigation: T3 spike first; split proven identical (selector-set diff + screenshot identity) before any tweak; shared rules live in the owning component file and dependants import it.
3. **Visual drift without a reference**: no screenshot suite exists today (two ad-hoc `page.screenshot` calls). Mitigation: T1 baseline before any change; every tweak commit names its intended screenshot diffs; unexpected pixel diffs fail.
4. **a11y parity loss when collapsing wrappers** (Modal / Popover / Table / Select): ARIA ownership (`aria-labelledby` from Heading, `role="dialog"` element) moves. Mitigation: ported upstream tests stay; per-suite test counts pinned; axe-core run on story routes.
5. **Concurrency**: big mechanical diffs on shared files while other lanes commit. Mitigation: shared-file commit rule (temp index, own hunks), batches ≤ 1 package each.
6. Losing upstream bug-fix flow (fork): accepted (no tracking today already).

### 8.2 Measurement

- Bytes per component before / after: new `scripts/size-report/ui-components.mjs` — per `@rivetjs/ui/<name>` subpath: DOM + server JS min / brotli, CSS min / brotli of its own file + transitive ui deps; baseline committed at T1 (`scripts/size-report/ui-components.md`), `--check` in CI after T4. Page budget: Button + TextField + Modal page CSS ≤ 40 KB min (today 717 KB); starter-ui `npm run size-report -- --check` baseline updated as an intended delta.
- a11y parity: per-suite test-case counts (cdk, cdk-browser, cdk-components, ui, ui-components) pinned in `$S`-free `libs/ui/tests-components/parity-counts.json`; never decrease without a listed reason; axe-core (`@axe-core/playwright`, dev-only, exact pin) zero violations on story routes light + dark.
- Visual regression: story app (`libs/ui/tests-components/app`) route per component state matrix; Playwright `toHaveScreenshot` (Chromium, 1280 + 390 widths, light + dark, LTR + one RTL pass), `maxDiffPixelRatio` 0; baselines in `libs/ui/tests-components/__screenshots__/` (PNG, git-lfs not needed at ≈ 3–6 MB total; checked size in T1). Tweak commits update only the screenshots their TWEAKS rows name (`screenshot-diff.ts` lists changed PNGs vs the commit's TWEAKS ids).
- Zero-cost: `sh scripts/zero-cost/check.sh` — new ui subpath hashes are intended deltas (named in commits); CSS joins zero-cost: `scripts/zero-cost/css-reach.mjs` asserts a page importing only `@rivetjs/ui/button` ships no other component's CSS.
- Perf: ssr-bench ui lane + resume-bench unchanged within noise after the CSS split (link count + bytes only); dom-bench untouched.

## 9. Rulings on the open questions (2026-10-11)

- Q1 Pro-L five: **decided** (§7): kanban → component task (plan T40), agenda → AGENDA lane (`2026-10-12-scheduler-design.md`), emoji-picker no, rich-text-editor not now, map no.
- Q2 Second theme: **no** (R6); `rivet` only, HeroUI look via `CLASSIC_PRESET` (was `HEROUI_PRESET`; renamed by DEBRAND 2026-10-12).
- Q3 Pill exemption: **accepted** (R5) + `radius="concentric"` opt-in.
- Mass prop rename: **not in this wave** (R4); naming review (plan T10) feeds a later decision.
