# Scheduler (agenda) — port spec

Lane AGENDA, phase 1 (design only). Source: the user's own Angular library `@malva-ui/scheduler` (`angular-ui-lib/libs/scheduler`, MIT, © 2026 Malva UI; ~15.5 k lines incl. 302 spec cases). Targets: headless `@rivetjs/cdk/scheduler` + styled `@rivetjs/ui/scheduler` (`Scheduler`), covering every public HeroUI Pro **Agenda** demo section (clean-room: section names only, `HERO-AUDIT.md` §2 "L: agenda (7)") plus malva's eight docs examples.

## 0. Rulings / scope

- Port = malva behaviour 1:1 (views, keyboard map, a11y model, announcements, focus hand-off, edge cases, tests), framework plumbing adapted: Angular DI / template defs / outputs / models → Rivet props, render functions, `on*` callbacks, signals.
- Replaced dependencies: SortableJS → `@rivetjs/cdk/drag-drop` engine (+ the ported `scheduler-pointer.ts` tracker for resize / range selection); `MlvDateAdapter<D>` → `@rivetjs/cdk/date` values; `MlvPopupService` / `mlv-menu` → cdk popover / menu on the div overlay layer; `MlvRtlService` → the grid element's computed `direction` (drag + keys, T8 ruling); `MLV_SCHEDULER_I18N` → `scheduler/intl.ts` (`LocalizedStrings`). No new npm dependency.
- In scope (new vs malva): HeroUI Pro Agenda sections Weekend Highlighting (`weekendDays`) and Month View Features (week numbers, today pill, `+N more`), server-final layout (SSR), resumability, `timeZone` for `ZonedDateTime` input.
- Out of scope (malva follow-ups, unchanged): resources / timeline / year / list-agenda views, recurrence, non-Gregorian layout (values in other calendars are converted to Gregorian for layout, labels formatted in the locale calendar), print / export, quick-info popover (users build it with `onEventAction` + Popover), overnight business hours.
- Naming (ruled at T2 by the AGENDA lane, no user reachable; revisit with the ui-identity naming sweep): `isReadOnly` (malva `editable` inverse), `allowsRangeSelection` (malva `selectable`), `density` = `compact | default | comfortable` — today's cdk vocabulary (`isReadOnly` on 49 cdk parts, RAC `allows*` booleans such as `allowsSorting` / `allowsDragging`; `density` has no precedent, values = the spec's); a later `is*` → HTML-name sweep (`docs/research/2026-10-12-ui-naming-review.md`) renames them with every other part.

## 1. Feature inventory → Rivet mapping

| # | malva feature (file) | Rivet |
| --- | --- | --- |
| F1 | Views `month` / `week` / `day`, `view` + `date` models, `next/previous/goToToday/goTo/setView`, `visibleRangeChange` on init + bound changes only (`scheduler.ts`) | `createSchedulerState` (`scheduler/state.ts`): `view`, `date` = `controllable()` (Signal two-way / value / default); free functions `schedulerNext(state)`, `schedulerPrevious`, `schedulerToday`, `schedulerGoTo(state, d)`, `schedulerSetView`; `visibleRange` / `title` computeds; `onVisibleRangeChange` from an equality-guarded computed: only on bound changes. Deviation: malva also emits on init; here the initial range belongs to the route loader (server data, no boot at load), documented with a loader snippet |
| F2 | Visible range, `firstDayOfWeek`, `hiddenDays` (day view still renders a hidden anchor day; navigation skips hidden days) (`layout/scheduler-layout.ts` `computeVisibleRange`, `visibleDays`, `nextVisibleDate`) | `scheduler/layout.ts` pure functions, ported 1:1 (same names minus the `Mlv` prefix) over integer day numbers; `firstDayOfWeek` = RAC `'sun' … 'sat'` (default: locale, as cdk Calendar; malva default Monday → docs note) |
| F3 | Event model `{id,title,start,end(excl),allDay,tone,color,draggable,resizable,data}`, end ≤ start repaired, ≥ 24 h timed → lane bar, midnight-crossing clipped per day (`normalizeEvent`, `isLaneEvent`, `sliceColumns`) | `SchedulerEvent<T>`; dates `CalendarDate` (all-day) / `CalendarDateTime` / `ZonedDateTime` (→ wall clock in `timeZone`) **or their `DateValueString`**; normalized once to integer `{ dayStart, minuteStart, dayEnd, minuteEnd }` (`toLayoutTime`) so layout never touches date objects |
| F4 | Month grid: lanes per week row (`assignLanes`, `layoutRow`), spanning bars sized in cell pitches, `+N more` overflow + toggling popover, `moreClick` | `layoutRow` port; lane count = `visibleLanes` prop (live; default from density) **computed on the server** instead of malva's row-height measurement (no layout read, risk R3); popover = cdk `DialogTrigger` + `Popover` (no underlay: pointer hit-testing during drag), chips inside are drag sources |
| F5 | Time grid week / day: all-day band (lanes), timed columns, overlap clustering sweep-line, ghosts full-width (`clusterColumns`) | `clusterColumns` port; geometry as inline CSS custom properties (`--rv-scheduler-event-top` / `-height` / `-start` / `-width`, malva names) computed on the server → final HTML, zero JS before input |
| F6 | `minTime` / `maxTime` (throws when min ≥ max), `slotDuration`, `snapDuration`, `defaultEventDuration` (`scheduler-time.ts`) | `layout.ts` (`parseTime`, `snapMinutes`, `clampMinutes`, `minutesFromOffset`, `slotCount`); invalid window = dev error `[rivet:cdk] scheduler: Invalid scheduler time window …` thrown in render (same text) |
| F7 | Business hours shading `{start,end,days?}` (default Mon–Fri) | `businessHours` prop; static background bands per column (inline style), `data-business` on slots |
| F8 | Current-time line + today pill; minute tick; `scrollToCurrentTime`; initial scroll top-aligns business start / 08:00; `scrollToTime()` once, settled-view semantics | now-line rendered client-only (`clientEffect` started on first visibility, `when: "visible"`; server renders none → no stale time in HTML); initial scroll = one client effect of the time grid (leaf module `time-grid-client.tsx`, no server attribute: the effect derives the target from the state, T4 ruling) (boots by design, listed in CLAUDE.md like masonry measured mode); `schedulerScrollToTime(state, "HH:mm")` request signal consumed once |
| F9 | Pointer drag-move (month cells, all-day band, time columns, `+N` popover), ghost preview (`__mlv-ghost` id), `canMove` veto, model write = new array, `eventMove` | `scheduler/drag.ts` (lazy chunk, T6 as built): one standalone cdk `DragRef` per press (root pinned via `constrainPosition`, scheduler-owned floating clone in `<body>`, source `pointer-events: none` + `data-dragging`); target from `elementFromPoint(pointer)` (time column: the clone's top edge; lane bars minus the grab-day offset); ghost = `normalized.ghost` copy through `state.dragPreview` (identical to malva); release → `resolveMove` → `canMove` → write. DOM never reordered; the `+N` panel is hidden (not disposed) during the gesture and closes after it; panel chips move but have no resize handles (deviation: no day cell owns them); drop lists only for external sources (F12) |
| F10 | Resize from both edges (handles ≥ 0.375 rem, `touch-action: none`), timed = block axis only, lane bars = inline axis by day, `canResize`, `eventResize` | `pointer.ts` `startPointerDrag` (port of malva `attachPointerDrag`: threshold 3 px, touch arms after 200 ms, capture, Escape) on the pressed handle + `resolveResize` port; preview rewrites the chip's geometry custom properties, restored before the commit; same lazy chunk (T6 as built; `interactions/move` not used: malva's tracker is the 1:1 source) |
| F11 | Range selection: pointer drag across empty cells (continuous multi-day interval), `Shift+Arrow` + `Enter`, `Escape` clears, touch 200 ms press arms | `selection` = `{ anchor, head }` signal pair in state; pointer via ported `attachPointerDrag` (`scheduler/pointer.ts`, `TOUCH_GESTURE_DELAY = 200`, `elementAt` hit-test); emits `onRangeSelect({ start, end, allDay, source })`. T7 as built: lazy `select.ts` from the delegated pointerdown; `state.selection` keyed by the rendered days; cells paint `aria-selected` / `data-selected`; keyboard `Shift+Arrow` / `Enter` / `Escape` land with the keyboard handlers (T8) |
| F12 | External drop (foreign SortableJS item of same `dragGroup`), `externalDrop {element,start,end,allDay}`, element returned to its list | cdk `<DropList>` per hit area connected through `dropListGroup` / `connectedTo` (`dropGroup` prop = DropList id group, live); `sortingDisabled`, empty `<DragPlaceholder>`; `onExternalDrop({ item: DragDrop.item.data, start, end, allDay })`; nothing inserted. T7 as built: ONE hit area = the scheduler body (`id = dropGroup`, `enterPredicate` = editable), the cell resolved from `dropPoint` (`elementFromPoint`), rendered only with `onExternalDrop` (0 cost otherwise) |
| F13 | Keyboard: roving grid focus, `Home/End`, `Ctrl+Home/End`, `PageUp/Down`, `Enter` into chips, chip `Alt+Arrow` move, `Alt+Shift+Arrow` end resize, `Ctrl+Alt+Arrow` start resize, `Delete/Backspace` → `eventDelete`, `Tab` ring of chips + `+N more`, ContextMenu / `Shift+F10`; logical arrows mirror in RTL (§5) | `scheduler/behaviour.ts` delegated handlers (no JSX) on the grid roots, inline arrows over a `ctx` literal (PROPS-CAPTURE, masonry precedent); `data-rk` so cold keys never scroll. **T8 as built:** `keys.ts` (shared: chips, `+N more`, selection helpers, `requestFocus`) + per-view leaves `keys-month.ts` / `keys-time-grid.ts`, delegated on the month grid / panel / sheet, actions = inline arrows on the root `SchedulerContext`; `data-rk` = navigation keys + `Space` / `Enter` / `ContextMenu` (cold `Shift+F10` not held). Known gap (review T7+T8 #1, measured): on a resumed page the first focus loads the whole scheduler graph (~74 scripts) because the handlers capture the root context → T10 handler split |
| F14 | Focus hand-off: chip leaving the model while focused → its cell (popover → panel group), Chromium blur-before-detach microtask rule | same rule in `behaviour.ts` (`pendingFocus` signal); ported spec cases incl. staged Chromium order. **T8 as built:** `keys.ts` `chipFocusIn` / `chipFocusOut` + a body `MutationObserver` removal watch while a chip holds focus; `requestFocus` always schedules resolution (microtask + ≤ 3 frames, then clears; a request is standing only inside that window, so a stale one never blocks the hand-off) |
| F15 | Announcements: two alternating polite live regions ("moved to …" audible twice) | cdk `announcer` (`announce(msg, "polite")`) — verify alternating-node behaviour, else port the two-slot region into the root (dev-checked). **T8 as built:** not the cdk announcer — the root renders malva's two alternating polite regions (`state.announcement` two-slot pair, `schedulerAnnounce`) |
| F16 | Template defs: `EventDef` (chip content; controls inside it own their clicks / keys), `HeaderDef` (toolbar API), `SlotMenuDef` / `EventMenuDef` (context menu items; pending keyboard selection consumed + released on close) | render-function props: `renderEvent(event, { view, allDay, continuesBefore, continuesAfter, isDragging, isGhost })`, `renderHeader(api)`, `renderSlotMenu(range, { selection, view, close })`, `renderEventMenu(event, { view, close })`; menus = cdk `Menu` in a `Popover` anchored to the cell / chip (keyboard open focuses first item, focus returns on close); no def → no menu plumbing, native `contextmenu` untouched (same `defaultPrevented` contract). T9 as built: one standalone NON-modal Popover per scheduler (no underlay / inert, so a second right-click re-targets; closes on Escape / action / focus leaving), pointer opens at the pointer (`getTargetRect`), keyboard opens against the cell / chip with the first item focused; the close clears the pending selection the menu took (no `selectionRelease` counter: one root selection signal); `renderMorePanel` not built (malva has no panel def) |
| F17 | Default toolbar (prev / today / next, title, month/week/day segmented) | cdk: `SchedulerToolbar` headless parts with `rv-*` classes (Button + ToggleButtonGroup); ui: HeroUI Button / ButtonGroup / Segment + lucide `ChevronLeft` / `ChevronRight` (mirrored in RTL). T9 as built: `SchedulerToolbar` (`toolbar.tsx`; prev / next carry `aria-label` only), live `toolbar` prop (malva input, `false` hides it), `renderHeader(api)` with accessors `title()` / `view()` / `range()` |
| F18 | Density (`--…-slot-height`, lane height, row min height, column min width, gutter) | ui `density` prop → root `data-density` + tv slot variants; cdk exposes geometry as CSS custom properties only |
| F19 | i18n: 24 keys × 14 locale packs (en, de, es, fr, it, ja, nl, pl, pt, ro, tr, uk, id, zh-Hans), ICU plural / select | `scheduler/intl.ts` (`LocalizedStrings<SchedulerMessageKey>`, hand-ported from malva packs; header names origin); plural / select keys split into `Intl.PluralRules` variants (`moreEvents.one` / `.other`, `previous.month` …) because cdk `formatString` interpolates only; dates via `DateFormatter` (`useLocale()`); override per instance with `strings` (live) |
| F20 | `user-select: none` on grids, touch: swipe scrolls both axes (`pan-x pan-y pinch-zoom`), drag / resize / select arm on 200 ms press | inline behaviour styles (headless rule: never class-keyed) |
| F21 | Host `role=group` named; month = one `grid`; time grid = labelled `group` + header/all-day `grid` + one `listbox` per day of `option` slots | same structure (§4) |
| F22 | HeroUI Pro Agenda: Views · Events · Drag Interactions · All-Day Events · Month View Features · Weekend Highlighting · Current Time Indicator | F1 · F3/F16 · F9–F12 · F3/F4/F5 · F4 + `showWeekNumbers` · `weekendDays` (`data-weekend`, default from `isWeekend(locale)`) + ui tint · F8 |

## 2. Package layout

```
libs/cdk/scheduler/
  CLAUDE.md        index.tsx (Scheduler, SchedulerToolbar parts, context rv-scheduler)
  layout.ts        pure: range / days / normalize / slice / lanes / cluster / resolveMove / resolveResize / focus math (port of layout/*.ts)
  time.ts          pure: parseTime, snapMinutes, clampMinutes, minutesFromOffset, slotCount (port of scheduler-time.ts)
  dates.ts         DateValue ↔ layout integers (day number + minute), DateValueString in / out, timeZone
  state.ts         createSchedulerState + free functions (serializable: strings / numbers only)
  month.tsx        month view          time-grid.tsx   week / day view       event.tsx  chip
  behaviour.ts     delegated keyboard / focus / click handlers (no JSX)
  drag.ts          lazy: DragRef move, resize (moveProps), ghost, external drop glue
  pointer.ts       lazy: range-select pointer helper (port of drag/scheduler-pointer.ts)
  intl.ts          strings
libs/ui/src/components/scheduler/{scheduler.tsx,index.ts}
libs/ui/styles/components/scheduler.css + styles/src/components/scheduler/scheduler.styles.ts (Rivet-authored, PATCHES.md / TWEAKS.md row; per-component CSS per ui-identity §3)
```

Subpaths: `@rivetjs/cdk/scheduler` (components), `@rivetjs/cdk/scheduler/layout` (layout + time + dates, server-safe, usable standalone for custom renderers), `@rivetjs/ui/scheduler`. Barrels `.tsx` (resume build follows `.tsx` re-exports only).

## 3. API

### 3.1 `Scheduler` (cdk) props — **live unless marked**

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `events` | `readonly SchedulerEvent<T>[] \| Signal<…> \| () => …` | `[]` | Signal = two-way (every change writes a new array); value / accessor = controlled, use `onEventsChange` |
| `view` / `defaultView` | `SchedulerView \| Signal` | `"month"` | `onViewChange` |
| `date` / `defaultDate` | `DateValue \| DateValueString \| Signal` | `today(timeZone)` | `onDateChange`; anchor |
| `timeZone` | `string` | zone resolved at creation, kept in region state (server: `"UTC"` + dev warning, the resumed page keeps it; client-only render: `getLocalTimeZone()` — docs: pass it) | `ZonedDateTime` events → wall clock |
| `firstDayOfWeek` | `'sun' … 'sat'` | locale | |
| `hiddenDays` | `readonly number[]` (0 = Sun) | `[]` | |
| `weekendDays` | `readonly number[]` | locale weekend | `data-weekend` (Pro: Weekend Highlighting) |
| `minTime` / `maxTime` | `"HH:mm"` | `"00:00"` / `"24:00"` | throws when min ≥ max |
| `slotDuration` / `snapDuration` / `defaultEventDuration` | minutes | `30` / slot / `60` | |
| `businessHours` | `{ start, end, days? } \| null` | `null` | |
| `visibleLanes` | `number \| "auto"` | `"auto"` = density default (3 / 4 / 5) | month lane cap; server-exact (replaces malva measurement); the time grid's all-day band never collapses (deviation from this spec's first draft, = malva: the band grows, T4 ruling; option if needed later: a `+N more` in the band reusing the month popover) |
| `isReadOnly` | `boolean` | `false` | malva `editable` inverse; disables move / resize / delete keys |
| `allowsRangeSelection` | `boolean` | `true` | malva `selectable` |
| `showCurrentTime` / `scrollToCurrentTime` / `showWeekNumbers` | `boolean` | `true` / `false` / `false` | |
| `canMove` / `canResize` | `(event, next) => boolean` | — | veto; inline arrow or local const (resumable) |
| `dropGroup` | `string` | `"rv-scheduler"` | id of the hit-area `DropList` the body becomes when `onExternalDrop` is set (T7 as built: external lists name it in `connectedTo` or share a `DropListGroup`); read once |
| `strings` | `Partial<SchedulerStrings>` | locale table | |
| `renderEvent` / `renderHeader` / `renderSlotMenu` / `renderEventMenu` / `renderMorePanel` | render functions | built-ins | **read once at mount** (RAC render-prop rule; their output is reactive) |
| `id`, `aria-label`, `class`, `style`, `GlobalDOMAttributes` | | | `id` read once (RAC); `aria-label` live (default i18n `scheduler`) |
| `on*` handlers | | | **read once** (handler rule) |

Callbacks: `onEventsChange(events)`, `onViewChange`, `onDateChange`, `onEventMove(change)`, `onEventResize(change)`, `onEventAction(i)` (click / Enter / Space; malva `eventClick`), `onEventDoubleClick`, `onEventContextMenu`, `onEventDelete`, `onSlotAction`, `onSlotDoubleClick`, `onSlotContextMenu`, `onRangeSelect`, `onExternalDrop`, `onVisibleRangeChange`, `onMoreAction` (malva `moreClick`).

Imperative / outside-toolbar API: `stateRef` (RAC-style `Signal<SchedulerState | null>`) + free functions (`schedulerNext/Previous/Today/GoTo/SetView/ScrollToTime`) and computeds `schedulerTitle(state)`, `schedulerVisibleRange(state)` (malva public signals `title`, `visibleRange`). `renderHeader(api)` receives `{ title, view, range, next, previous, today, setView, goTo }` (accessors + inline arrows).

### 3.2 Types (`scheduler/layout.ts`, re-exported)

`SchedulerView`, `SchedulerEvent<T>` (`id`, `title`, `start`, `end` excl., `allDay?`, `color?: "default" | "accent" | "success" | "warning" | "danger"` (malva `tone`: info → accent), `cssColor?` (wins), `isDraggable?`, `isResizable?`, `data?: T`), `SchedulerRange` (`{ start, end, allDay }`, malva `NextRange`), `SchedulerEventChange` (`{ event, previous, source: "pointer" | "keyboard" }`), `SchedulerEventInteraction` (`{ event, element, nativeEvent }`), `SchedulerSlotEvent`, `SchedulerRangeSelectEvent`, `SchedulerExternalDropEvent`, `SchedulerVisibleRange`, `SchedulerBusinessHours`, `SchedulerCanChange`, `SchedulerHeaderApi`, `SchedulerEventRenderState`, `SchedulerMenuContext`, `SchedulerMoreEvent`. Written-back dates keep the input form (string in → string out, instance in → same class out). Kind conversions (ruling, T1–T6 review): all-day → timed writes date-times; timed → all-day keeps the input class / string shape at midnight (`…T00:00:00`, `allDay: true`, no date-only rewrite); zoned stays zoned.

### 3.3 Date adapter mapping (`MlvDateAdapter<D>` → `@rivetjs/cdk/date`)

Layout runs on integers: `day` = days since 1970-01-01 (proleptic Gregorian, from `toCalendarDate(toCalendar(v, gregorian))`), `minute` = 0…1440. Adapter calls used by malva → replacement: `addCalendarDays` / `shiftDays` → `day + n`; `startOfDay` → `{ day, 0 }`; `compareDate` / `compareDateTime` / `sameDate*` → integer compare; `addMinutes` / `withTime` / `minutesOfDay` / `differenceInMinutes` / `getHours` / `getMinutes` → minute arithmetic; `getDayOfWeek` → `(day + 4) % 7`; `getMonth` / `getYear` / `createDate` / `addCalendarMonths` → `CalendarDate` `.add({ months })` at range edges only; `today` / `now` → `today(timeZone)` / `now(timeZone)`; labels (`getDateLabel`, `getMonthYearLabel`, `getDayOfWeekNames`, `getDayOfMonthLabel`, `format`) → `DateFormatter` (cached per locale + options, `i18n/intl-cache`). Results are written back via `fromLayout(day, minute, like)` (same class / calendar / zone as the input; `ZonedDateTime` through `toZoned(…, timeZone)`, DST gap → `"compatible"`). malva "Invalid Date propagates" → an unparsable string is a dev warning + unplaced event.

### 3.4 ui `Scheduler`

`@rivetjs/ui/scheduler`: `Scheduler` (not compound; data-driven like Masonry / DataGrid) = cdk `Scheduler` + `schedulerVariants` tv slots (`base`, `toolbar`, `title`, `grid`, `header`, `cell`, `slot`, `allDay`, `event`, `eventTitle`, `eventTime`, `more`, `morePanel`, `nowLine`, `handle`, `menu`) on every part class prop (user classes appended), props `variant: "default" | "secondary"`, `density: "compact" | "default" | "comfortable"`, default toolbar from ui Button + Segment + lucide icons (`kit/icon`), event colors = HeroUI chip palette (soft surface + bar), dark mode via theme tokens, `data-slot="scheduler"`. Per-component CSS `styles/out/scheduler.css` (ui-identity §3, R3 look rules: concentric radii, spacing scale).

## 4. Accessibility (malva model kept)

- Root `role=group` + `aria-label` (i18n `scheduler`).
- Month: one `role=grid` (`row` of `columnheader`s, `rowgroup` of week `row`s of `gridcell`s); week-number `rowheader` when `showWeekNumbers`; `+N more` = button `aria-haspopup=dialog` / `aria-expanded` / `aria-controls`, name leads with visible text (WCAG 2.5.3); popover = labelled `group`.
- Time grid: sheet = labelled `group`; header + all-day band = 2-row `grid`; each day column = `listbox` (`aria-multiselectable` while range selection allowed) of `option` slots; chip overlay `presentation`. Column-major DOM (drop hit areas per day).
- Chips: `aria-label` = i18n `eventLabel` / `eventLabelAllDay`, `aria-description` = `dragHint` when editable.
- Keyboard map = malva table (Grid cells / Selection / Chips / `+N more` / popover / Context menu rows) verbatim; horizontal keys logical (RTL mirrored by the grid element's computed `direction`, as the pointer drag: a `dir` attribute or the locale), vertical / Home / End / Page keys never mirror. T8 as built: delegated `keys-month.ts` / `keys-time-grid.ts` on `keys.ts` (leaf chunks), pending focus resolved imperatively by its producer (no view effect), focus hand-off through a removal watch while a chip holds focus, announcements kept in the root's two polite regions.
- Announcements: `eventMoved`, `eventResized`, `moveRejected`, `rangeChanged`, `selectionHint`.
- Tests: axe pass per view (month, week, day, popover open, menu open) in `cdk-browser` and ui story app.

## 5. RTL

Grid columns flip via `dir` (CSS logical properties only: `inset-inline-start`, `margin-inline`), drag deltas mirrored on the inline axis, chevrons mirrored, menus resolve direction from the anchor's `dir` scope (malva rule kept). Tests: keyboard + pointer move in `dir=rtl` (ported cases + RTL duplicates of the move / resize specs).

## 6. SSR / resume

- Server output is final: range, days, layout (lanes, clusters, geometry custom properties), labels, business-hours bands, `+N more` counts. No layout read on the client before input; no `data-boot` at load except the time-grid initial-scroll effect (week / day only; month: none) and the now-line (`visible`). Story asserts: month view `data-boot` absent.
- State serializes: events as given if strings; `DateValue` instances in a user signal are **refused by the resume format** → docs + dev error point to `DateValueString` (R2). Internal state stores strings / integers only.
- Chunks: grid key / click / focus handlers (`behaviour.ts`) plan `intent`; `preload="intent"` on the view roots; `drag.ts` + `pointer.ts` are `import()`ed on the first pointerdown on a chip / handle / empty cell (press replayed with original timing, drag-drop `_pointerDownFromHost` pattern) → first drag loads only the drag chunk; menus / popover chunks on first open. **As built (T8, measured 2026-10-12):** the grid handlers sit in `month.tsx` / `time-grid.tsx` and capture the root context, so the first focus / key on a resumed month fetches the full graph (state, intl, layout, menu, popover); later input fetches nothing. T10 moves them onto a small signals + server-attribute context with lazily reached actions and imports `select.ts`' state code only after the 5 px threshold (`tests-components/scheduler-resume.test.ts` `test.fails` until then).
- Render functions are resumable (RAC rule); menu / popover content = function children (closed-overlay rule).
- Event handlers inline arrows over a `ctx` literal; `canMove` / `canResize` user functions must be inline or local consts (docs).

## 7. Performance budget (gates in T12)

| Metric | Budget |
| --- | --- |
| Server layout, 1,000 timed events / week view | < 2 ms (`layout.ts` alone, warm, M-series), < 6 ms whole server render of the view |
| Server layout, 1,000 events / month view | < 2 ms |
| Client bytes (min+br), month view, no interaction | ≤ 6 KB handler chunks planned `intent`; 0 B executed before input |
| First drag chunk (`drag.ts` + drag-drop engine closure) | ≤ 14 KB br, measured in `tests-components/cold-latency.ts` |
| Drag frame | no forced reflow per pointermove (one `elementFromPoint` + rect cache from `onStarted`), ≤ 1 layout pass per frame (Performance trace test), ghost update = one signal write |
| Zero-cost | unused subpaths 0 B; `scheduler/layout` importable without components |

Rules from masonry apply: no `<style>` element, frozen style objects, geometry as inline custom properties, no reads in effects except the declared ones.

## 8. i18n

`SchedulerMessageKey` = malva keys `scheduler`, `today`, `previous.{month,week,day}`, `next.{…}`, `month`, `week`, `day`, `viewSwitch`, `allDay`, `moreEvents.{one,other}`, `moreEventsLabel.{one,other}`, `gridLabel.{month,week,day}`, `slotLabel`, `dayLabelToday`, `eventLabel`, `eventLabelAllDay`, `dragHint`, `eventMoved`, `eventResized`, `moveRejected`, `rangeChanged`, `selectionHint`, `eventMenu`, `slotMenu` + Rivet `weekNumber`. 14 locales ported from malva packs, locale tags normalized to cdk form (`de-DE`, `zh-Hans` …; fallback through `getStringsForLocale`). App-level `@rivetjs/i18n` catalogs pass overrides through `strings`.

## 9. Tests to port (malva 302 cases → vitest)

| malva spec | cases | Rivet target (project) |
| --- | --- | --- |
| `layout/scheduler-layout.spec.ts` | 32 | `libs/cdk/tests/scheduler-layout.test.ts` (cdk) — verbatim inputs via a `CalendarDateTime` fixture helper |
| `layout/scheduler-time.spec.ts` | 8 | `scheduler-time.test.ts` (cdk) |
| `layout/scheduler-focus.spec.ts` | 10 | `scheduler-focus.test.ts` (cdk) |
| `drag/scheduler-pointer.spec.ts` | 12 | `scheduler-pointer.browser.test.tsx` (cdk-browser) |
| `drag/scheduler-drag.service.spec.ts` | 20 | `scheduler-drag.browser.test.tsx` (cdk-browser; SortableJS specifics → DragRef equivalents, listed per case) |
| `event/scheduler-event.spec.ts` | 50 | `scheduler-event.browser.test.tsx` |
| `month/scheduler-month.spec.ts` | 49 | `scheduler-month.browser.test.tsx` |
| `time-grid/scheduler-time-grid.spec.ts` | 58 | `scheduler-time-grid.browser.test.tsx` |
| `scheduler/scheduler.spec.ts` | 36 | `scheduler.browser.test.tsx` |
| `scheduler/scheduler-context-menu.spec.ts` | 21 | `scheduler-menu.browser.test.tsx` |
| `scheduler/scheduler-styles.spec.ts` | 6 | `libs/ui/tests/scheduler-styles.test.ts` (ui; pitch / token assertions on compiled CSS) |
| `testing/*` | 1 | test helpers `tests/scheduler-fixtures.ts` |

Plus Rivet-only: `scheduler-ssr.test.ts` (server HTML final, 1k-event cost log, no `data-boot` in month), `tests-components/scheduler-resume.test.ts` (resumed page: first drag loads only the drag chunk, keyboard move cold, menu open cold), RTL duplicates, ui story `/scheduler` (screenshots light / dark / compact / rtl). Every case keeps its malva title (traceability), exceptions listed in `libs/cdk/scheduler/CLAUDE.md`.

## 10. Docs

- cdk-docs `content/components/scheduler.md` (nav Pickers > Date & time after RangeCalendar): anatomy, events model + date forms, views, drag / resize / selection, external drop, render functions, context menus, keyboard table, a11y, resumability, layout API (`@rivetjs/cdk/scheduler/layout`), origin note. Examples `scheduler-*` headless (Tailwind): the eight malva docs examples — `views-binding`, `all-day`, `drag-vetoes`, `custom-event`, `working-hours`, `custom-header-external-drop`, `range-density-locale`, `context-menus`.
- ui-docs `content/components/scheduler.md` (`:::note` Rivet addition, feature set inspired by HeroUI Pro Agenda public docs, independent implementation; not in `upstream-sections.json`; headings = Pro section list: Views, Events, Drag Interactions, All-Day Events, Month View Features, Weekend Highlighting, Current Time Indicator) + examples `scheduler-{views,events,drag,all-day,month-features,weekend,current-time}` + the eight malva examples styled; Rivet-authored demo headers.
- Generated: llms outputs, MCP data (`build-data.ts`), api.json for both sites.

## 11. Licensing

malva-ui LICENSE = MIT (© 2026 Malva UI). MIT requires the copyright + permission notice in copies / substantial portions → add a `libs/cdk/NOTICE` entry (MIT text, list of ported files) and file headers `// Ported from @malva-ui/scheduler (<files>), MIT, © 2026 Malva UI (the Rivet author's own library).` The user is the copyright holder and may waive it; default = keep the notice (cheap, correct). HeroUI Pro: public section names only, no Pro source (memory rule).

## 12. Risks

- **R1 drag model mismatch:** cdk drag-drop is a sortable-list engine; scheduler needs free placement over a grid + resize + external drop. Plan: standalone `DragRef` (no DropList) for chips, DropLists only as external-drop hit areas with sorting disabled + empty placeholder. Spike first (T5) — fallback: own pointer engine on `interactions/move` (still no dependency). **T5 decision (2026-10-12): cdk drag-drop.** Spike (Chromium, throwaway test): one standalone `DragRef` per chip created on the first press (`_pointerDownFromHost`, lazy like `<Drag>`), root pinned with `constrainPosition` (returns the initial top-left: the chip never moves, so no clipping by cells / scroller / popover and no DOM move — a drop-list `DragRef` would move the element into `<body>`, which For-managed rows must not see), a scheduler-owned floating clone in `<body>` (fixed, `pointer-events: none`, `aria-hidden`) follows the raw pointer (`moved.event` client coords: with `constrainPosition`, `pointerPosition` is the pinned top-left), source chip `pointer-events: none` + faded, target = `elementFromPoint` → closest `[data-rv-minutes]` → `resolveMove` → `dragPreview` ghost → re-layout, `ended` → `commitChange`. External: a `<Drag>` in a `<DropList sortingDisabled connectedTo>` with an empty `<DragPlaceholder>` lands on a `sortingDisabled` hit-area `<DropList>` (`onDropped` gives `dropPoint` + `item.data`). Numbers (week, 7 × 48 slots, headless Chromium): handler 0.03–0.08 ms avg per pointermove (cell unchanged: dedupe, no write), ≤ 0.5 ms p95 handler + reactive flush + forced layout on a cell change (one layout pass per frame, from the ghost insert), release → commit + re-layout ≈ 10 ms incl. two test task turns. Test gotcha: the vitest iframe is ~414 px wide — `elementFromPoint` outside it returns `null`; T6 fixtures keep the grid inside the viewport.
- **R2 date values vs resume:** `DateValue` class instances in user signals do not serialize; string form must be the documented default and every callback must round-trip the input form.
- **R3 month lane count without measurement:** server cannot measure row height; `visibleLanes` explicit / density default may show `+N more` where malva fitted more lanes. Optional client refinement effect (boots) behind `visibleLanes="fit"`.
- R4 context menu dependency: cdk has no context-menu trigger yet (HERO-AUDIT `context-menu` missing) → scheduler opens Menu in a Popover at a virtual anchor; share with the future context-menu lane.
- R5 size: keyboard + a11y map is large; keep `behaviour.ts` split by view so the month handler chunk stays ≤ 6 KB min+br (T8: `keys-month` + `keys` + `behaviour` ≈ 2.9 KB gz, accepted).
