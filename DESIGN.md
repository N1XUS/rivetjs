# Rivet design

Design preferences, look, composition rules for `@rivetjs/ui`, `@rivetjs/cdk` styling, docs sites (`apps/docs`, `apps/cdk-docs`, `apps/ui-docs`), showcases, examples, templates. Binding for agents doing visual work in this repo.

- Detailed sources: UI identity spec `docs/design/specs/2026-10-11-ui-identity-design.md` (rulings R1–R6, tweak tables), tweak log `libs/ui/styles/TWEAKS.md`, consumer design skill `skills/rivet-ui-design/` (source `libs/mcp/ai/skills/design-ui*`), motion spec `docs/design/specs/2026-10-11-motion-design.md`.
- Precedence: user ruling > this file > spec details > component defaults. A conflict between this file and code = stale doc; fix both in the same change.

## Principles

- Restraint over decoration. Hierarchy from type, spacing, alignment; not from boxes, colour, gradients.
- Similar look, improved: Rivet UI is an evolution of the HeroUI v3 base (soft surfaces, pill buttons, field shells, overlay shadows). Fix defects, never restyle a component into something unrecognisable.
- Geometry derived, not hand-picked: concentric radii, one spacing scale, icon size from font size.
- Every visual tweak carries a number (before → after, contrast for colour changes) and a `TW-nn` row in `TWEAKS.md`.
- Light + dark parity: every state readable in both.
- Pay per component: CSS ships with the component that uses it; untouched component = 0 bytes CSS + JS.
- Real content always (realistic names, numbers, long titles, empty / error states). Never lorem ipsum.

## Brand + colour

- Brand palette = `logo.svg` gradient (never edit the logo): cyan `#01EEF9` → blue `#0360FA` → indigo `#262CFA` → violet `#5B00F8` / `#B815F9` → magenta `#F827F5` / `#F930BF`.
- Accent: `oklch(0.52 0.24 264)` (indigo-blue); white text AA incl. hover mix. Danger `oklch(0.56 0.215 26)`.
- Neutrals: slight hue bias to 264 (`base` chroma 0.005), never pure mid-grey. Shadows hue-tinted `oklch(0.25 0.02 264 / α)`.
- Colour by role, via semantic tokens only: `--background` / `--foreground`, `--surface*`, `--overlay*`, `--muted`, `--accent*`, `--success` / `--warning` / `--danger` (+ `-foreground`), `--border`, `--separator`, `--focus`, `--field-*`. No hex literals in components, examples, showcases.
- Status colour never alone: pair with text or icon.
- Gradient only on brand surfaces: landing hero, `Button variant="brand"`, progress / meter `color="brand"`, chart series `--chart-1…7` (logo stops, ≥ 3:1 vs surface). Never on focus, body text, state colours.
- Gradients soft + sparing, mostly indigo → violet. Saturated full-spectrum / "hard" gradients rejected.
- Contrast: WCAG 2.2 AA (4.5:1 text, 3:1 large text + non-text) + APCA Lc ≥ 60 body / 45 large / 30 non-text. Check hover, selected, focus, invalid, overlay states, muted text on every surface level.

## Dark mode

- Default follows `prefers-color-scheme` (kit `<ThemeScript>`, `data-theme="system"`); explicit `data-theme` wins; pre-paint script, no flash.
- Elevated surfaces in dark: 1 px hairline (≈ 8 % white) on cards + overlays, not lightness alone.
- Focus ring in dark raised to L 0.68 (≥ 3:1 vs surface and control).
- Not an inversion: tune contrast per theme; accent must work on both backgrounds.

## Typography

- Docs sites: `Manrope` (sans + display), `Fira Code` (mono), with fallback stacks (`libs/docs-kit/theme.css`).
- UI kit: keep the Tailwind type scale (12/16, 14/20, 16/24, …); `Typography.Heading` h1–h6 `text-4xl` → `text-base`; body `text-base leading-7`, `text-sm leading-6`, `text-xs leading-5`.
- Roles, not sizes per element: page title 24–32 semibold; section 18–20; reading 16 at 1.5–1.75; dense rows / controls 14–16; metadata 12–14.
- Reading width ≈ 60–75 characters. Tabular numerals for metrics, prices, tables. Headings `text-wrap: balance`.
- No tiny uppercase grey labels as the primary field identifier.

## Geometry

- **Concentric radii (golden rule):** child inset `p` inside parent radius `R` → child radius `max(R − p, 0)`; border counts as padding. Tokens `--r-outer`, `--pad`, `--r-inner`; nested containers re-declare `--r-outer: var(--r-inner)`.
- Pills exempt by default (Button, Chip, Tag, Tab, calendar cell); `radius="concentric"` opt-in.
- Theme radii: `--radius` 8 px, `--field-radius` 12 px; `--radius-3xl` 24 px for overlays / cards.
- **Spacing scale** (4-pt base, ≈ 1.5 ratio): 4 · 6 · 8 · 12 · 16 · 24 · 36 · 52. Off-scale values (2, 10, 40, `p-[3px]`) are defects.
- Control padding ratio (x : y): pill controls 2 : 1 (lg 2.25 : 1), rectangular fields 1.5 : 1, list items 1.33 : 1.
- Field anatomy: label ↓ 6, description / error ↓ 4, field group gap 16.
- Spacing expresses relationship: gap inside a group < gap between groups. Use `gap` on flex/grid, not per-element margins. Never change global `--spacing` to fix one page.
- Density: `data-density="compact | comfortable"` on an ancestor shifts one scale step; whole regions, never single rows.
- Hit targets: ≥ 44 × 44 on `pointer: coarse` via `touch-target` (visual size unchanged); ≥ 24 × 24 on fine pointers.

## Icons

- **HIGH PRIORITY:** lucide only, via `import { Icon } from "@rivetjs/kit/icon"`. Never invented SVG paths, never UTF glyphs (✓ × ▾ → ★ …) as icons.
- Optical sizes 16 / 20 / 24 (12 / 14 only inside 12-px chips / indicators). Map: text 12 → 14, 14 → 16, 16 → 20, 18+ → 24.
- Stroke per size: 16 → 2, 20 → 1.75, 24 → 1.5, 12–14 → 2 `absoluteStrokeWidth`; set via `--icon-size` / `--icon-stroke` on the slot.
- `flex: none`, square box, no negative margins; align to first text line.
- Spinner size = icon size of the host control.

## Surfaces + elevation

- Card / Surface marks a distinct object or section, not every block. No card-in-card stacks; related settings rows = one section with separators.
- Elevation reserved for floating content (menus, popovers, dialogs) and genuinely elevated controls.
- Disabled: `opacity 0.5` + `cursor: var(--cursor-disabled)` everywhere.
- Grayscale test: remove accent mentally; task + action hierarchy must still read.

## Motion

- Duration tokens: `--duration-fast` 120, `--duration-base` 180, `--duration-slow` 260 ms; overlay enter 180 / exit 120. Colour transitions ≈ 150, transform ≈ 200.
- Easing `--ease-smooth: cubic-bezier(0.2, 0, 0, 1)`.
- Press feedback `scale(0.97)` on pill controls only.
- Animate opacity / transform; never delay navigation or input for an animation; honour `prefers-reduced-motion`.
- Custom element animation → `@rivetjs/motion` (`<Motion.*>`, `Presence`, layout); CSS-only entrances ship 0 JS. Drag / flick physics → cdk Embla-based motion (carousel, slider, drawer, sidebar).
- Stepped sliders drag freely, animated snap on release (default).

## Composition (UI + showcases + examples)

- Build from `@rivetjs/ui` components first; `@rivetjs/cdk` headless only for a genuinely different visual treatment (and then style every interactive state); semantic HTML for regions without behaviour.
- No hand-built UI markup where a ui component exists (lists → `ItemCardGroup`, app shell → ui `Sidebar`, compare grids → `Table`, links styled as buttons → `Button render={a}`, not copied classes).
- Customisation through **slots / parts, not bespoke props + CSS**: users must be able to swap content (e.g. `ItemCard.Indicator` is a slot with a default, not an `isUnread` prop with fixed CSS). Prefer a small reusable component over one-off styling (e.g. a `Status` dot with semantic `color`, `size`, `pulse`; CSS-only — landing with SHOWCASE-2).
- A ui gap found while building a page → fill it in `@rivetjs/ui` (docs page + demo + test, zero-cost), not local CSS in the example.
- Keep component anatomy (root → trigger / label / content / items); start from a real Rivet example.
- One dominant action per action group. No nested interactive targets (button in a clickable card / anchor).
- Showcases must honour `apps/ui-docs/content/showcase/overview.md`: only `@rivetjs/ui` components, `@rivetjs/kit` icons and a few Tailwind layout classes.
- Every screen checked with: long titles, many rows, empty data, validation errors, pending actions, 390 px width, light + dark, keyboard focus + restore.
- Layout: content sets height; no stretched empty boxes; repeated items share edges, baselines, padding; text wraps or scrolls in its own container, never clipped; page never scrolls horizontally.

## Docs sites

- Identity: angular.dev-level polish + density, de-cloned (own fonts, own nav, soft header glow); not a replica. Variant "Manual" (Plex, numbered chapters, hard gradient) rejected.
- Homepage = selling landing page: hero promise + CTA, proof numbers, feature blocks with real product visuals, polished benchmark section, closing CTA. Benchmarks: Vercel / Linear / Bun / Astro / Svelte landings.
- Rejected as "cheap" / "90s": plain bordered chart cards, mono-number tables, pill badge rows, boxed charts.
- Live examples are real pages (iframes of built frames), honest numbers (JS meter shows real bytes).
- Show 2 rendered directions before building out a big visual change.
- Each docs site credits its upstreams where useful (React Aria patterns, HeroUI-inspired design) and has a licences page.

## Images

- Reuse existing images; generate only missing ones (codex, low effort, ≤ 80 KB, plain + realistic).
- AI-generated images are never design references ("neuroslop"); design from real, well-regarded sites.

## Accessibility floor (never traded for looks)

- Upstream behaviour quality (React Aria / Stately / RAC / Angular CDK): roles, ARIA wiring, keyboard maps, focus management, typeahead, RTL, IME, touch.
- Visible focus on every interactive element; focus is never a gradient.
- Logical CSS properties (RTL); physical `left` / `right` / `translate-x` only when mirrored.
- Behaviour-critical cdk styles (visually-hidden, underlay, stacking) inline from JS, never keyed on classes; overlays use the shared div layer, never native `<dialog>` / `popover`.
