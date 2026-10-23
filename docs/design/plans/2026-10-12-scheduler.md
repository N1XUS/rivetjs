# Scheduler (agenda) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@rivetjs/cdk/scheduler` (headless month / week / day scheduler, port of the user's `@malva-ui/scheduler`) + `@rivetjs/ui/scheduler` (`Scheduler`, HeroUI look) covering every HeroUI Pro Agenda demo section and malva's eight docs examples; server-final layout, resumable, first drag loads only the drag chunk.

**Architecture:** Pure integer layout engine (`scheduler/layout.ts`, 1:1 port of malva `src/lib/layout`) feeds server-rendered views; state in a serializable `createSchedulerState` factory; keyboard / focus in delegated `behaviour.ts`; pointer move / resize / range-select / external drop in lazy chunks on cdk drag-drop `DragRef` + `interactions/move`; overlays = cdk Popover / Menu; ui wraps with tv slots + per-component CSS.

**Tech Stack:** TypeScript (Node 26), `@rivetjs/cdk/date`, `@rivetjs/cdk/drag-drop`, cdk interactions / popover / menu / announcer / i18n, vitest + Playwright Chromium, Tailwind v4 (ui CSS build), docs-kit, lucide via `@rivetjs/kit/icon`.

**Spec:** [`docs/design/specs/2026-10-12-scheduler-design.md`](../specs/2026-10-12-scheduler-design.md). Source (read only, never modify): `/Users/denisseverin/Projects/claude-test/angular-ui-lib/libs/scheduler` (+ `apps/docs/src/app/pages/scheduler`, `libs/i18n/*/src/lib/*.ts` scheduler sections).

## Resumed implementation status — 2026-10-23

T1–T12 are implemented and reviewed. T13 adds 15 UI demos, eight CDK demos and public API documentation; both full docs builds, all 23 changed production demo manifests, parent iframe/narrow-layout checks and content/API/AI gates pass. T14 records the completed integration gates and reviewed generated size/hash baselines; original performance limits remain explicit. The full UI production suite has 20 failures outside Scheduler; all 20 were reproduced in controlled comparisons without the runtime fix. The older UI component size baseline retains unrelated differences. The historical checklists below describe the original requirements; an unchecked performance target is not a passing gate.

The current derived runtime adopts the ordinary Scheduler renderer on first interaction. Cold keyboard/click/menu/drag behavior passes, but the historical drag-only closure and obsolete `preload="intent"` design do not apply. The original byte targets remain unmet. Complete SSR of 1,000 visible week events is 11.072 ms against the unchanged < 6 ms target. Pure layout meets < 2 ms. See the [measured report](../../benchmarks/2026-10-23-scheduler.md) and [306-row mapping](../research/2026-10-23-scheduler-upstream-cases.md) for exact scope and limitations.

The original private scratchpad and heavy-command wrapper no longer exist. Resumed work uses a private plan workspace, serial heavy jobs, one browser project at a time and `--maxWorkers=1`. The removed `resume-context.test.ts` registry and intent-preload planner are not recreated. Current production behavior is verified directly.

## Global Constraints

- `S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad`; read `$S/perf/IMPL-COMMON.md` (binding).
- RAM / CPU: heavy commands (docs builds, story-app builds, full vitest projects, size-report, zero-cost) only via `bash $S/heavy.sh …` with **2 slots** for this lane; vitest `--maxWorkers=1`; **one browser-test project at a time** (never `cdk-browser` + `ui-components` in parallel); ≤ 3 GB tree RSS; no long-running dev servers (start → check → kill in one command; never ports 4320–4329).
- Env: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; zsh; repo root, absolute paths.
- Zero-cost: every new subpath independently tree-shakeable (`scheduler`, `scheduler/layout`, `ui/scheduler`); nothing in a runtime entry imports test / dev code; new hashes = intended `sh scripts/zero-cost/check.sh --update` delta named in the commit.
- Live props: every prop live (LIVE-SWEEP rule); read-once only for handlers, render functions, `id` — listed on `libs/cdk/scheduler/CLAUDE.md` "Read once:" line + "Read once at mount" in JSDoc. Every live prop gets a live-update test.
- Resumability: handlers inline arrows over a `ctx` literal (PROPS-CAPTURE); state = strings / numbers only (no `DateValue` instances in signals); overlay content = function children; context id `rv-scheduler` registered in `tests-components/resume-context.test.ts`.
- Icons: lucide only (`@rivetjs/kit/icon` in ui, local `Icon.tsx` copies in examples); never hand-written SVG paths or UTF glyphs.
- Headless cdk: `rv-Scheduler*` default classes + `data-*` state; behaviour styles inline (`touch-action`, `user-select`, geometry custom properties); no `<style>` element, no Tailwind classes in cdk sources.
- Shared files (`libs/cdk/package.json`, `libs/ui/package.json`, `libs/cdk/NOTICE`, `apps/*/api.config.ts`, `content/_nav*`, `docs/CLAUDE.md`, `libs/ui/styles/components/index.css`, `scripts/zero-cost/*`, size-report baselines): add own hunks only; other lanes edit them concurrently.
- Git (shared tree): temp index per commit — `export GIT_INDEX_FILE=$S/idx-AGENDA-$$; git read-tree HEAD; git add -- <own files>` (a file with another lane's uncommitted hunks: blob = HEAD + own hunks via `git hash-object -w` + `git update-index --cacheinfo`), `git commit`, `unset GIT_INDEX_FILE`, then `git show --name-only --format= HEAD | xargs git reset -q --`; verify `git diff --stat HEAD~1 HEAD` lists only own files.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Docs follow code: nearest `CLAUDE.md` + every doc describing the API updated in the same commit; generated outputs (`llms`, MCP data, AI files, api.json) regenerated, never hand-edited.
- No Rust: compiler gaps found on the way → patch to `$S/patches/AGENDA-<n>.patch` + `.md`, root builds.
- Origin headers: `// Ported from @malva-ui/scheduler (<files>), MIT, © 2026 Malva UI.` + `Rivet:` / `Deviation:` bullets; files listed in `libs/cdk/NOTICE`.

### Gate commands (each task lists which it runs)

```bash
H="bash $S/heavy.sh"
# G-UNIT    npx vitest run --project cdk --maxWorkers=1 libs/cdk/tests/scheduler-*.test.ts
# G-CDKB    $H npx vitest run --project cdk-browser --maxWorkers=1 libs/cdk/tests/scheduler-*.browser.test.tsx
# G-CDKC    $H npx vitest run --project cdk-components --maxWorkers=1 libs/cdk/tests-components/scheduler-*.test.ts
# G-UI      $H npx vitest run --project ui --maxWorkers=1 ; G-UIC $H npx vitest run --project ui-components --maxWorkers=1
# G-TYPE    npx nx run cdk:typecheck && npx nx run ui:typecheck (--output-style=static --skip-nx-cache)
# G-ZERO    $H sh scripts/zero-cost/check.sh
# G-SIZE    $H npm run size-report -- --check
# G-DOCS    $H npx nx run cdk-docs:build ; $H npx nx run ui-docs:build ; node libs/docs-kit/cli.ts check-content <app> --strict ; check-snippets <app> ; llms <app> --check
# G-AI      node libs/mcp/build-data.ts --check && node libs/mcp/ai/sync.ts --check
# G-FMT     npm run format:check
```

## File Structure

- `libs/cdk/scheduler/{CLAUDE.md,index.tsx,layout.ts,time.ts,dates.ts,state.ts,month.tsx,time-grid.tsx,event.tsx,toolbar.tsx,behaviour.ts,drag.ts,pointer.ts,menus.tsx,intl.ts}`; `layout-index.ts` → subpath `scheduler/layout`.
- `libs/cdk/tests/scheduler-{layout,time,focus,dates,state,ssr}.test.ts`, `scheduler-fixtures.ts`, `scheduler-{pointer,drag,event,month,time-grid,root,menu,rtl,live-props}.browser.test.tsx`; `libs/cdk/tests-components/app` story `/scheduler` + `scheduler-resume.test.ts`.
- `libs/ui/src/components/scheduler/{scheduler.tsx,index.ts}`, `libs/ui/styles/components/scheduler.css`, `libs/ui/styles/src/components/scheduler/{scheduler.styles.ts,index.ts}`, `libs/ui/tests/scheduler{,-styles}.test.ts`, ui story `/scheduler`.
- `apps/cdk-docs/content/components/scheduler.md` + `examples/scheduler-*` (8); `apps/ui-docs/content/components/scheduler.md` + `examples/scheduler-*` (7 Pro sections + 8 malva).
- `apps/dom-bench` or `libs/cdk/tests/scheduler-bench.test.ts` (perf gates, T12).

## Task overview

| # | Task | Depends |
| --- | --- | --- |
| T1 | Types, time + date bridge, layout engine + ported unit tests | — |
| T2 | State factory, intl, naming confirmation | T1 |
| T3 | Month view (SSR-final) + chips + `+N more` popover | T2 |
| T4 | Time grid week / day (all-day band, clusters, business hours, now-line, scroll) | T2 |
| T5 | Drag spike: `DragRef` free drag over the grid (go / fallback decision) | T3 |
| T6 | Pointer drag-move + resize + ghost + vetoes (lazy chunk) | T4, T5 |
| T7 | Range selection (pointer + keyboard) + external drop | T6 |
| T8 | Keyboard map, focus hand-off, announcements | T3, T4 |
| T9 | Toolbar, header API, context menus, render functions | T8 |
| T10 | Resume + chunk plan + live props | T6–T9 |
| T11 | ui `Scheduler` styling (tv, CSS, density, dark, tones, weekend, week numbers) | T9 |
| T12 | A11y (axe) + RTL + perf bench + size | T10, T11 |
| T13 | Docs + examples (cdk-docs, ui-docs) + generated outputs | T11 |
| T14 | Final: full gates, CLAUDE.md sweep, report | all |

### Task T1: Types + layout engine (port first, tests first)

**Files:** `libs/cdk/scheduler/{layout.ts,time.ts,dates.ts,layout-index.ts,CLAUDE.md}`, `libs/cdk/tests/scheduler-{layout,time,focus,dates}.test.ts`, `scheduler-fixtures.ts`, `libs/cdk/package.json` (`./scheduler/layout` export), `libs/cdk/NOTICE`.

- [ ] Port `scheduler-time.spec.ts` (8), `scheduler-layout.spec.ts` (32), `scheduler-focus.spec.ts` (10; DOM lookups `findEventElement` / `findCellElement` → `data-rv-*` selectors) to vitest with a fixture that builds `CalendarDateTime` / string inputs from malva's `new Date(y, m, d, h, min)` literals; titles unchanged. Run → red.
- [ ] `time.ts`: 1:1 port (`MINUTES_PER_DAY`, `DEFAULT_BUSINESS_DAYS`, `parseTime` incl. throw text, `snapMinutes`, `clampMinutes`, `minutesFromOffset`, `slotCount`).
- [ ] `dates.ts`: `toLayoutTime(value, timeZone)` → `{ day, minute }` (proleptic Gregorian day number), `fromLayout(day, minute, like, timeZone)` (same form / class / calendar / zone as `like`), `dayOfWeek(day)`, `todayDay(timeZone)`; label helpers over `DateFormatter` cache.
- [ ] `layout.ts`: port every export of `scheduler-layout.ts` (`startOfWeek`, `computeVisibleRange`, `hiddenWeekdays`, `visibleDays`, `rowLength`, `dayIndexOf`, `normalizeEvent`, `isLaneEvent`, `lastDayOf`, `spansMultipleDays`, `sliceRows`, `sliceColumns`, `assignLanes`, `layoutRow`, `clusterColumns`, `daySpan`, `resolveMove`, `resolveResize`) + `nextVisibleDate` from `scheduler-focus.ts` on integers; normalize each event once; sort keys numeric.
- [ ] `dates` tests: DST gap / overlap for `ZonedDateTime`, non-Gregorian input round-trip, string ↔ instance form preservation.
- [ ] Gates: G-UNIT, G-TYPE, G-FMT. Commit `feat(cdk): scheduler layout engine (port of @malva-ui/scheduler layout)`.

### Task T2: State, intl, naming

**Files:** `scheduler/{state.ts,intl.ts}`, `tests/scheduler-state.test.ts`.

- [ ] Ask the user the three naming questions of spec §0 (`isReadOnly`, `allowsRangeSelection`, `density` values); record answers in the spec.
- [ ] `createSchedulerState(props)`: `controllable` `events` / `view` / `date`; computeds `visibleRange`, `days`, `title`, `normalizedEvents`, `monthLayout`, `timeGridLayout`; free functions `schedulerNext/Previous/Today/GoTo/SetView/ScrollToTime`, `commitChange(state, change)` (new array, `onEventsChange`); `visibleRangeChange` only on bound change (spec F1 deviation). Serializable: strings / numbers only (test: `JSON.stringify` of every signal value).
- [ ] `intl.ts`: 14 locales from malva packs (keys spec §8; plural / select keys split; header names source files); `schedulerString(strings, key, vars, locale)` with `Intl.PluralRules`.
- [ ] Gates: G-UNIT, G-TYPE. Commit.

### Task T3: Month view

**Files:** `scheduler/{index.tsx,month.tsx,event.tsx}`, `tests/scheduler-month.browser.test.tsx` (non-drag cases of 49), `tests/scheduler-ssr.test.ts`, story `/scheduler`.

- [ ] Port month spec cases that do not need drag / keyboard (rendering, lanes, spanning bars, `+N more` counts, popover open / toggle / close, `moreClick` once, `today` pill, hidden days, week numbers, weekend `data-weekend`).
- [ ] `Scheduler` root (`role=group`, `SchedulerContext` `rv-scheduler`), month `grid` markup; geometry as inline custom properties from `monthLayout`; `visibleLanes` (server-exact, spec R3); popover = cdk `DialogTrigger` + `Popover` without underlay, function children.
- [ ] SSR test: server HTML contains every chip + `+N` with final geometry; no `data-boot` in month.
- [ ] Gates: G-UNIT, G-CDKB (scheduler files), G-TYPE. Commit.

### Task T4: Time grid (week / day)

**Files:** `scheduler/time-grid.tsx`, `tests/scheduler-time-grid.browser.test.tsx` (non-drag cases of 58).

- [ ] Port render cases: header + all-day 2-row grid, listbox per day, slots per `slotDuration`, `minTime` / `maxTime` window + throw, cluster columns, midnight clipping, ≥ 24 h promotion, business-hours bands, now-line (client-only, `visible`), initial scroll (business start / 08:00 / `scrollToCurrentTime` centred below sticky header, fallback rules), `scrollToTime` once + settled-view semantics, `touch-action: pan-x pan-y pinch-zoom`.
- [ ] Gates: G-UNIT, G-CDKB, G-TYPE. Commit.

### Task T5: Drag spike (decision gate)

**Files:** `$S/agenda/T5-spike.md` (scratch), throwaway story route.

- [ ] Prove on the story app (Chromium): standalone `DragRef` per chip (`previewContainer: "global"`, source faded, preview `pointer-events: none`), `onMoved` → `elementFromPoint` → cell → ghost signal → re-layout, `onEnded` → reset transform + commit; external `<Drag>` from a connected `<DropList sortingDisabled>` with empty `<DragPlaceholder>` landing on a scheduler hit-area DropList; measure pointermove cost (Performance trace: layout passes per frame).
- [ ] Decide: cdk drag-drop (default) or fallback own pointer engine on `interactions/move` + `pointer.ts` (no new dependency either way); write decision + numbers into spec §12 R1. Ask user only if fallback is chosen.

### Task T6: Drag-move + resize (lazy)

**Files:** `scheduler/drag.ts`, `scheduler/event.tsx` (handles), `tests/scheduler-drag.browser.test.tsx` (20), drag cases of event / month / time-grid specs.

- [ ] Port `scheduler-drag.service.spec.ts` (SortableJS specifics mapped case by case; mapping table in `libs/cdk/scheduler/CLAUDE.md`), chip drag / resize cases (both edges, none on continuing edges, block axis for timed, lane bars by day, `+N` popover hidden not disposed during drag, ghost id suffix, ghost = copy with same color, dashed border via `data-ghost`).
- [ ] `drag.ts` loaded by `import()` from the chip's pointerdown (press replayed with original timing, drag-drop `_pointerDownFromHost` pattern); `canMove` / `canResize` vetoes + `moveRejected` announcement; touch 200 ms press arms, mouse 5 px threshold; root `user-select: none` while dragging.
- [ ] Gates: G-CDKB, G-TYPE. Commit.

### Task T7: Range selection + external drop

**Files:** `scheduler/pointer.ts`, `tests/scheduler-pointer.browser.test.tsx` (12), selection cases.

- [x] Port `attachPointerDrag` + spec; continuous multi-day timed interval; head from `elementFromPoint` (touch capture rule); `onRangeSelect` (pointer + keyboard `Shift+Arrow` / `Enter` / `Escape`).
- [x] External drop: hit-area DropLists joined by `dropGroup`; `onExternalDrop({ item, start, end, allDay })`; foreign element stays in its list; `defaultEventDuration` for timed drops.
- [x] Gates: G-CDKB, G-TYPE. Commit. As built: `scheduler/select.ts` (lazy range-select chunk) + `pointer.ts`; `tests/scheduler-pointer.browser.test.tsx` 24 = the 12 `scheduler-pointer.spec.ts` cases + range selection on the rendered scheduler (incl. fix round 1: Escape on the focused pressed cell / slot still swallows the trailing click) + external drop.

### Task T8: Keyboard, focus, announcements

**Files:** `scheduler/behaviour.ts`, keyboard / focus cases of event (50) / month / time-grid / root specs.

- [x] Delegated handlers per view (split so the month chunk stays small): roving focus, Home / End, Ctrl+Home / End, PageUp / Down, Enter into chips, chip Alt / Alt+Shift / Ctrl+Alt arrows, Delete / Backspace → `onEventDelete` (prevented), Tab ring incl. `+N more`, Escape to cell; logical arrows via locale direction; `data-rk`.
- [x] Focus hand-off of a removed chip (cell / popover group; Chromium blur-before-detach microtask case staged by hand); popover closes + day cell focused when nothing overflows.
- [x] Announcements via cdk `announcer` (verify two-in-a-row audibility; else two alternating regions in the root). As built: the two alternating polite regions in the root (`state.announcement` pair), not the cdk announcer.
- [x] Gates: G-CDKB, G-TYPE. Commit. As built: `scheduler/keys.ts` (shared) + `keys-month.ts` / `keys-time-grid.ts` (not `behaviour.ts`), actions on the root `SchedulerContext`; `tests/scheduler-keyboard.browser.test.tsx` 72. Fix round 1 (review T7+T8): `requestFocus` always schedules resolution, a request stands only inside its resolve window (stale ones never block the hand-off); `ContextMenu` in `data-rk`. Known gap → T10: the handlers capture the root context, so on a resumed page the first focus loads the whole scheduler graph (~74 scripts measured, `scheduler-resume.test.ts` `test.fails`).

### Task T9: Toolbar, header API, menus, render functions

**Files:** `scheduler/{toolbar.tsx,menus.tsx}`, `tests/scheduler-root.browser.test.tsx` (36), `tests/scheduler-menu.browser.test.tsx` (21).

- [x] Default toolbar (headless parts: prev / today / next buttons, title heading, view ToggleButtonGroup; `rv-*` classes; no glyphs — icons only in ui / examples); `renderHeader(api)` replaces it.
- [x] `renderEvent` (controls inside own their click / keys), `renderSlotMenu` / `renderEventMenu`: cdk Menu in a Popover anchored to the cell / chip; right-click + ContextMenu key / Shift+F10 claim rules; pending keyboard selection consumed + released on close; no render fn → no menu DOM, native `contextmenu` untouched; panel `aria-label` `eventMenu` / `slotMenu`; re-target on second right-click.
- [x] Gates: G-CDKB, G-TYPE. Commit. As built: root file 14 cases (the state-level root cases already live in `scheduler-state.test.ts`, keyboard / delete / scroll ones in their view files), menu file 21 (malva 22: density → panel classes, axe → T12).

> **Historical pause at T9 + fix round 1 (2026-10-12; resumed 2026-10-23).** Done: T1–T9, T1–T6 review fixes, T7+T8 review fix round 1 (#1 measured + documented as known gap, #2, #3, #4, #8). Next T10, carrying: (1) review #1 cold-key closure — measured: first focus of a resumed month cell fetches ~74 scripts (state, intl, layout, menu, popover, toolbar) because `month.tsx` / `time-grid.tsx` handlers capture the root context (index.tsx arrows / computeds + user closures; resume decodes captures eagerly). Design: handler module on a small context of signals + server attributes (`data-rv-day`, row length, axis, readonly, handler / menu flags), roving tab stop written to the DOM, actions reached lazily (custom-event hop to a root handler or `import()`), `select.ts` imports state code only after the 5 px threshold; flip `scheduler-resume.test.ts` `test.fails` to `test`. (2) review #5 placeholder / month-cell drop. (3) review #6 five unported malva cases. Then T11–T14.

### Task T10: Resume, chunk plan, live props

**Files:** `tests-components/app` story `/scheduler` (resumed), `tests-components/scheduler-resume.test.ts`, `tests/scheduler-live-props.browser.test.tsx`, `tests-components/resume-context.test.ts` (id).

- [ ] Resumed page: no `data-boot` at load (month); week view boots only the initial-scroll effect; cold keyboard move works; first pointer drag fetches only the drag chunk closure (network log); menu / popover chunks on first open; `preload="intent"` on view roots; measure with `cold-latency.ts`.
- [x] Live-update test for every live prop (spec §3.1 table); read-once list in CLAUDE.md + JSDoc.
- [ ] Gates: G-CDKC, G-CDKB, G-ZERO. Commit (zero-cost `--update` delta named).

### Task T11: ui `Scheduler`

**Files:** `libs/ui/src/components/scheduler/*`, `libs/ui/styles/components/scheduler.css`, `libs/ui/styles/src/components/scheduler/*`, `libs/ui/styles/{PATCHES.md|TWEAKS.md}` row, `libs/ui/package.json`, `libs/ui/tests/scheduler{,-styles}.test.ts` (6 ported style cases), ui story `/scheduler`, `libs/ui/src/components/CLAUDE.md` row.

- [x] tv slots (spec §3.4), `variant`, `density` (slot height / lane height / row min height / column min width / gutter tokens), event colors = HeroUI chip palette + `cssColor`, weekend tint, week-number column, now-line accent, dark mode tokens, concentric radii (ui-identity R3), focus rings not clipped by the scroller (inset form inside scroll containers), reduced-motion paths.
- [x] Toolbar from ui Button / ButtonGroup / Segment + lucide `ChevronLeft` / `ChevronRight` / `CalendarDays`; menu items from ui Dropdown styles.
- [x] Screenshots light / dark / compact / RTL and desktop/narrow docs; generated Scheduler CSS 18,408 compiled / 2,601 Brotli bytes, with own-code and standalone-app scopes recorded in the performance report.
- [ ] Gates: G-UI, G-UIC, G-TYPE, G-SIZE. Commit.

### Task T12: A11y, RTL, perf

**Files:** `tests/scheduler-rtl.browser.test.tsx`, axe cases, `tests/scheduler-ssr.test.ts` (cost), `scripts/size-report` baseline row.

- [x] axe pass per view + popover open + menu open (cdk-browser + ui story); RTL duplicates of move / resize / keyboard cases.
- [ ] Perf gates (spec §7): layout 1,000 events / week < 2 ms and month < 2 ms (median of 50 warm runs, logged), server render < 6 ms; drag frame ≤ 1 layout pass (trace), no forced reflow; client bytes per entry within budget. Regression = fix before T13.
- [ ] Gates: G-CDKB, G-UIC, G-SIZE, G-ZERO. Commit.

### Task T13: Docs + examples

**Files:** `apps/cdk-docs/content/components/scheduler.md` + `_nav` hunk + `examples/scheduler-*` (8 malva examples, headless Tailwind); `apps/ui-docs/content/components/scheduler.md` + `_nav` hunk + `examples/scheduler-*` (7 Pro sections + 8 malva, Rivet-authored headers); `api.config.ts` entries; regenerated api.json / llms / MCP data / AI files; `apps/*/CLAUDE.md` rows.

- [x] Pages per spec §10 (UI independent-implementation note links licenses; named HeroUI Pro Agenda inspiration is attributed on the licenses page, consistent with the docs brand gate); DateValueString guidance + loader snippet for the initial range; keyboard table; resumability section.
- [x] Gates: G-DOCS, G-AI, G-FMT for docs/source. Full docs builds use `--no-checks`; all 23 changed Scheduler production manifests run separately. Content/snippets/llms/MCP/AI and brand checks pass; no quarantine.

### Task T14: Final

- [x] Execute and record full/scoped gates: types, Scheduler unit/browser/resume, full UI unit, full UI production, zero-cost, full app size, docs/API/AI, formatting and scripts. Scoped checks pass. Full UI production has 20 failures, all reproduced without the runtime correction; the older UI component exact-size report retains 107 unrelated differences. Neither is claimed green. Original whole-week SSR and cold-handler budgets remain unmet.
- [x] CLAUDE.md sweep: `libs/cdk/CLAUDE.md` (entry rows), `libs/cdk/scheduler/CLAUDE.md`, `libs/ui/src/components/CLAUDE.md`, `libs/ui/styles/CLAUDE.md`, `apps/{cdk,ui}-docs/CLAUDE.md`, root `CLAUDE.md` repo map if needed, `docs/CLAUDE.md` index; `HERO-AUDIT` is absent from this checkout; no replacement audit was invented.
- [x] Ported-case ledger: [306 expanded upstream cases](../research/2026-10-23-scheduler-upstream-cases.md), including 305 product cases. The original 302 counted ordinary product declarations before expanding `it.each`; title correspondences and composed equivalents are distinguished from deviations. This is not automated parity certification.
- [x] [Report](../../benchmarks/2026-10-23-scheduler.md): measured bytes/performance, integration evidence, reviewed corrections, deviations and remaining limits.
