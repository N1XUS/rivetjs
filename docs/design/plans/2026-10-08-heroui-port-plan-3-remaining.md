# HeroUI port — Plan 3: every remaining component (4 parallel lanes)

**Goal:** Port the 53 HeroUI v3.2.6 component dirs not yet in `libs/ui`, each with its ui-docs page mirroring heroui.com (every upstream demo), so `@rivetjs/ui` = the whole HeroUI v3 kit.

**Architecture:** Same as Plans 1–2 (port pattern in `libs/ui/src/components/CLAUDE.md`). Live props landed (P1–P4): props are live; no keyed re-creation workarounds. Behaviour comes from `@rivetjs/cdk/<name>` (RAC parts with `render`); a missing cdk behaviour is ported into cdk first (1:1 React Aria, with upstream tests), never re-implemented inside ui.

**Spec:** `docs/design/specs/2026-10-07-heroui-port-design.md`. **Previous:** `2026-10-08-heroui-port-plan-2-components.md` (Global Constraints there apply verbatim, except "props are snapshots" — superseded by live props). **Docs:** `apps/ui-docs/CLAUDE.md` (page = upstream mdx headings + demos, drift test `tests/sections.test.ts`, gap list).

## Global Constraints (additions to Plan 2)

- Upstream HeroUI v3.2.6 @ `73000ea`, clone at `$S/heroui` (`S` = session scratchpad). Docs source: `$S/heroui/apps/docs/content/docs/en/react/components/(<category>)/<name>.mdx` + demos `apps/docs/src/demos/en/<c>/<d>.tsx`.
- Per component: ui port + tests (server / DOM / types / Chromium where events matter, upstream tests ported) + ui-docs page with every upstream demo live + nav entry + sections snapshot + gap-table update (remove rows this lane closes, e.g. Input / TextField / Dropdown / Select / TagGroup demos marked "Not yet ported").
- Shared files (`libs/ui/index.ts`, `libs/ui/package.json`, `libs/ui/tests/package.test.ts`, `apps/ui-docs/content/_nav/components.ts`, `libs/cdk/package.json`, `libs/cdk/CLAUDE.md` module table): several lanes edit them concurrently → edit only your rows, commit through a temp `GIT_INDEX_FILE` with only your hunks (recipe in Plan 2). `scripts/zero-cost/packages.txt`: not touched by lanes (orchestrator updates once).
- Motion: physics-driven settles / swipes use the Embla-derived cdk motion module (carousel lane) once it lands; until then, use the existing cdk behaviour, never ad-hoc JS easing.
- Stepped sliders: free drag + animated snap on release (default; `snap="drag"` = React Aria).
- Memory caps on every run; ports ≥ 4400; kill only your own PIDs.

## Lanes

| Lane | Components (HeroUI dirs) |
| --- | --- |
| P3-FORMS | input, textarea, textfield, input-group, input-otp, search-field, number-field, fieldset, form, checkbox, checkbox-group, radio, radio-group, switch, switch-group, slider |
| P3-COLLECTIONS | list-box (+item, section), select, combo-box, autocomplete, dropdown, menu (+item, section), tag, tag-group, table, pagination, breadcrumbs, toolbar |
| P3-OVERLAYS | popover, tooltip, modal, alert-dialog, drawer, toast, accordion, disclosure, disclosure-group, tabs |
| P3-DATE-COLOR | calendar, calendar-year-picker, range-calendar, date-field, date-input-group, date-picker, date-range-picker, time-field, color-area, color-field, color-input-group, color-picker, color-slider, color-swatch, color-swatch-picker |

Order inside a lane: leaf parts first (shared parts like Input before TextField / SearchField / NumberField; ListBox before Select / ComboBox; Popover before Select / Dropdown — P3-COLLECTIONS imports P3-OVERLAYS' Popover once committed, until then a local import of the cdk popover is fine and switched after).

## Done criteria

- Every HeroUI component dir has a `libs/ui/src/components/<name>/` port + `@rivetjs/ui/<name>` subpath; ui-docs drift test lists every upstream component page; gap table only lists genuinely unportable items (brand logos, Next Image).
- Gates: `ui`, `ui-components`, `ui-docs` vitest projects, `tsc -p libs/ui`, `ui-docs:typecheck`, check-content / check-snippets ui-docs, `ui-docs:build`; zero-cost rows added by the orchestrator on a clean HEAD copy.
