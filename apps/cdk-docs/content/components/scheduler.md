---
title: Scheduler
description: "Headless month, week and day scheduling with server event layout, move and resize, range selection, custom headers and context menus."
template: reference
status: experimental
related: [components/calendar, components/range-calendar, components/menu, components/drag-and-drop]
---

`Scheduler` renders a month calendar or a week/day time grid. It owns layout, keyboard navigation, pointer editing, selection and announcements; application CSS supplies the presentation. For styled defaults use [Rivet UI Scheduler](site:ui/components/scheduler/).

:::note
Scheduler behavior is ported from the Rivet author's MIT-licensed `@malva-ui/scheduler`, with Rivet signals, date values, server layout and CDK drag/drop. The examples are Rivet-authored adaptations of its eight functional examples.
:::

## Usage and anatomy

```tsx
import { Scheduler, type SchedulerEvent } from "@rivetjs/cdk/scheduler";
import { signal } from "@rivetjs/reactivity";

export default function Schedule() {
  const events = signal<readonly SchedulerEvent[]>([
    { id: "review", title: "Design review", start: "2026-10-20T09:00", end: "2026-10-20T10:00" },
  ]);
  return <Scheduler events={events} defaultDate="2026-10-20" timeZone="UTC" aria-label="Team schedule" />;
}
```

| Part | Element / class | Semantics |
| --- | --- | --- |
| Root | `div.rv-Scheduler` | Named group, `data-view`, drag state and polite announcements. |
| Toolbar | `.rv-SchedulerToolbar` | Previous/next/Today buttons, title, view radio group. Headless previous/next buttons need application-provided icons or a custom header. |
| Month | `.rv-SchedulerMonth-grid` | Grid with weekday headers, week rows and roving day cells. |
| Time grid | `.rv-SchedulerTimeGrid-sheet` | Named group; all-day grid plus daily listboxes of option slots. |
| Event | `.rv-SchedulerEvent` | Keyboard-focusable button role with full date-bearing label. |
| Resize handles | `.rv-SchedulerEvent-resize-handle` | Pointer targets at eligible start/end edges. |
| Overflow | `.rv-SchedulerMonth-more` / `.rv-SchedulerMonth-popover` | Expanded button and portaled dialog/group of hidden chips. |
| Context menu | `.rv-SchedulerMenu-popover` / `.rv-SchedulerMenu` | Non-modal popover and menu; rendered only when a menu renderer exists. |

## Views and controlled values

::example{id=scheduler-views-binding}

`events`, `view` and `date` accept values, accessors or two-way signals. Accepted event edits replace the array; controlled values use `onEventsChange`. `defaultEvents`, `defaultView` and `defaultDate` are read once. The default view is month.

Locale supplies the default first weekday and weekends. Set `firstDayOfWeek` explicitly when matching a server data query. `hiddenDays` removes weekdays from month/week; day view may still show a chosen hidden anchor, while next/previous day navigation skips hidden weekdays.

## Event model and all-day spans

All event and selection ranges have an **exclusive end**. An all-day event from Monday to Wednesday occupies Monday and Tuesday. Use date-only strings for whole-day data and unique stable ids.

::example{id=scheduler-all-day}

| Field | Type | Meaning |
| --- | --- | --- |
| `id` / `title` | string | Unique stable identity / visible title and base accessible name. |
| `start` / `end` | `SchedulerDate` | Inclusive start and exclusive end. |
| `allDay` | boolean | Whole-day range; time parts are ignored. |
| `color` | `default`, `accent`, `success`, `warning`, `danger` | Semantic event color. |
| `cssColor` | CSS color | Custom color, taking precedence over semantic color. |
| `isDraggable` / `isResizable` | boolean | Per-event capability, both true by default; read-only still wins. |
| `data` | `T` | Application payload, preserved by edits. Keep it serializable in resumable state. |

An end at or before the start is repaired to one day for all-day events, or `defaultEventDuration` for timed events. A timed event lasting at least 24 wall-clock hours uses a spanning lane; shorter midnight-crossing events split over time-grid days. Moving preserves wall-clock duration across DST changes. String input produces string output; date-time/zoned forms retain their shape, including midnight for a timed event moved into all-day lanes.


## Move and resize

::example{id=scheduler-drag-vetoes}

Drag a chip or its start/end handle. Touch gestures arm after 200 ms so swipes can still scroll; Escape cancels. `snapDuration` defaults to `slotDuration`. Return false from `canMove` or `canResize` to reject a proposed range. `isReadOnly` disables editing; `allowsRangeSelection` separately controls selection. Per-event drag/resize flags keep other events editable.

## Custom event contents

::example{id=scheduler-custom-event}

`renderEvent(event, state)` replaces chip contents. State includes view, all-day status, continuation edges, dragging and ghost status. The scheduler preserves accessible labels and delegated interaction; controls inside custom content own their clicks/keys.

## Working hours and current time

::example{id=scheduler-working-hours}

`minTime`/`maxTime` set the axis; the minimum must precede the maximum. `businessHours` shades outside working hours and defaults to Monday–Friday; shading does not veto edits. Overnight business windows are unsupported. `showCurrentTime` controls today and the minute clock. The now-line appears only when the current day and time are visible. `scrollToCurrentTime` centers initial scrolling on now; otherwise it starts at business start or 08:00.

## Custom header and external drop

::example{id=scheduler-custom-header-external-drop}

`renderHeader(api)` replaces the toolbar. The API has reactive `title()`, `view()`, `range()`, translated `labels` and `next`, `previous`, `today`, `setView`, `goTo`. `toolbar={false}` hides only the default header.

With `onExternalDrop`, the body becomes a CDK hit-area `DropList`. Name its `dropGroup` in the foreign list's `connectedTo`, or share a `DropListGroup`. The callback receives the item's data and a proposed end-exclusive range; the source item returns to its list. Application code creates an event and may remove the backlog item. An empty `DragPlaceholder` avoids foreign-list geometry; the scheduler also suppresses a default foreign placeholder while entered.

## Range selection, density and locale

::example{id=scheduler-range-density-locale}

Drag empty cells/slots, or Shift+Arrow then Enter, to emit a continuous range. Month/all-day selections use whole days; time-grid selections use rendered slots. Escape clears. The demo creates an event from a range and a one-hour quick event from a slot action. CDK geometry is application CSS; its density control changes slot classes/lane caps. The styled UI component provides a `density` prop.

## Context menus

::example{id=scheduler-context-menus}

`renderSlotMenu(range, context)` and `renderEventMenu(event, context)` return CDK `MenuItem`s. The scheduler supplies Menu and non-modal Popover. Right-click, ContextMenu or Shift+F10 opens the supplied menu; Escape closes it and restores focus. Scrolling an ancestor closes a menu when its anchor moves; a queued scroll from before opening does not dismiss a menu already at its final anchor. Slot menus consume the pending keyboard selection when opened inside it; closing releases it. `context.close()` dismisses the panel. Without a renderer, native pointer context menus remain untouched.

## Props

| Prop | Type | Default | Behavior |
| --- | --- | --- | --- |
| `events` / `defaultEvents` | `readonly SchedulerEvent<T>[]`; `events` also accepts a signal or accessor | `[]` | A signal is two-way; a value/accessor is controlled. Defaults are read once. |
| `view` / `defaultView` | `"month"` / `"week"` / `"day"`; `view` also accepts a signal or accessor | `"month"` | Active view. |
| `date` / `defaultDate` | `SchedulerDate`; `date` also accepts a signal or accessor | today in the resolved zone | Anchor date, written back in its original form. |
| `timeZone` | `string` or accessor | creation zone: UTC on the server | Wall-clock zone used for layout; pass explicitly for SSR. |
| `locale` | `string` or accessor | ambient locale | Labels, time formatting and week/weekend defaults. |
| `firstDayOfWeek` | `"sun"` … `"sat"` or accessor | locale | First column of month/week views. |
| `hiddenDays` / `weekendDays` | `readonly number[]` or accessor | `[]` / locale weekends | Weekday numbers; Sunday is 0. |
| `minTime` / `maxTime` | `"HH:mm"` or accessor | `"00:00"` / `"24:00"` | Visible time window; minimum must be earlier than maximum. |
| `slotDuration` | positive minutes or accessor | `30` | Time-grid row size. |
| `snapDuration` | positive minutes or accessor | slot duration | Move/resize snapping. |
| `defaultEventDuration` | positive minutes or accessor | `60` | Timed external drops, all-day to timed moves and invalid timed-end repair. |
| `businessHours` | `{ start, end, days? }`, `null` or accessor | `null` | Outside-hours shading; default days Monday–Friday. No overnight window. |
| `visibleLanes` | `number`, `"auto"` or accessor | `"auto"` = 3 | Month cap; all-day time-grid lanes always grow to fit. |
| `isReadOnly` | boolean or accessor | `false` | Disables move, resize and delete requests. |
| `allowsRangeSelection` | boolean or accessor | `true` | Pointer and keyboard range selection, independently of editing. |
| `showCurrentTime` | boolean or accessor | `true` | Today marker and visible time-grid clock. |
| `scrollToCurrentTime` | boolean or accessor | `false` | Centers the initial time-grid scroll on now when in range. |
| `showWeekNumbers` | boolean or accessor | `false` | ISO week-number column in month view. |
| `strings` | `Partial<SchedulerStrings>` or accessor | locale table | Per-instance translated string overrides. |
| `canMove` / `canResize` | `(event, nextRange) => boolean` | — | Return false to veto a proposed edit; read once. |
| `toolbar` | boolean | `true` | Hides the default toolbar when false. A custom header takes precedence. |
| `renderEvent` | `(event, renderState) => Content` | time and title | Chip contents; scheduler keeps semantics and interactions. Read once. |
| `renderHeader` | `(api: SchedulerHeaderApi) => Content` | toolbar | Custom navigation/header; read once. |
| `renderSlotMenu` | `(range, context) => Content` | — | Menu items for a cell, slot or pending selected range; read once. |
| `renderEventMenu` | `(event, context) => Content` | — | Menu items for an event; read once. |
| `dropGroup` | string | `"rv-scheduler"` | External hit-area DropList id; read once. |
| `stateRef` | `Signal<SchedulerState<T> \| null>` or `(state) => void` | — | Access state for free-function navigation; read once. Keep state references local to client interaction. |
| `id` | string | — | Root id, read once; internal part ids are generated. |
| `aria-label` | string | translated “Scheduler” | Accessible root group name. |
| `class` / `style` | string / CSS property record | headless classes / — | Live root presentation. |
| `classNames` | `SchedulerClassNames` | — | Live classes appended to individual parts and portaled panels. |

Other global DOM attributes and events are forwarded to the root div. Component behavior handles its own delegated grid/chip events; custom content controls keep their own input. Capture-event callbacks do not currently resume.


## Events and callbacks

| Callback | Payload | When |
| --- | --- | --- |
| `onEventsChange` | new immutable event array | Accepted move or resize. Save this array for a controlled value. |
| `onViewChange` / `onDateChange` | next view / anchor date | Scheduler navigation writes the controlled value. |
| `onEventMove` / `onEventResize` | `{ event, previous, source }` | Accepted edit; `source` is `pointer` or `keyboard`. |
| `onEventAction` / `onEventDoubleClick` / `onEventContextMenu` | `{ event, element, nativeEvent }` | Activation, double click or context-menu request. |
| `onEventDelete` | `{ event, element, nativeEvent }` | Editable event receives Delete/Backspace; application removes it. |
| `onSlotAction` / `onSlotDoubleClick` / `onSlotContextMenu` | `{ date, allDay, element, nativeEvent }` | Empty cell or slot interaction. |
| `onRangeSelect` | `{ start, end, allDay, source }` | Committed pointer or keyboard range. |
| `onExternalDrop` | `{ item, start, end, allDay }` | Connected foreign item drops; application creates the event. |
| `onVisibleRangeChange` | `{ view, start, end }` | Scheduler navigation changes range day bounds; no initial emission or caller-owned signal-write emission. |
| `onMoreAction` | `{ date, events }` | Overflow panel opens; `events` contains hidden events for that day. |

Callbacks and veto hooks are read once at mount. Controlled values, option props and presentation props remain live. Render functions are read once; their rendered output can read reactive values.


## State and layout API

Obtain `SchedulerState` through `stateRef` for outside controls. Free functions from `@rivetjs/cdk/scheduler` are `schedulerNext`, `schedulerPrevious`, `schedulerToday`, `schedulerGoTo(state,date)`, `schedulerSetView(state,view)`, `schedulerScrollToTime(state,time)`, `schedulerTitle` and `schedulerVisibleRange`. A scroll request is consumed once in a settled time-grid view; month requests are dropped.

`@rivetjs/cdk/scheduler/layout` is server-safe and imports no components or DOM. Layout uses day numbers since 1970-01-01 and wall minutes (`day * 1440 + minute`).

| Helpers | Purpose |
| --- | --- |
| `computeVisibleRange`, `visibleDays`, `startOfWeek`, `nextVisibleDate`, `hiddenWeekdays`, `rowLength`, `dayIndexOf` | Compute period bounds and displayed weekdays. |
| `dayFromCivil`, `civilFromDay`, `dayOfWeek`, `addCalendarMonths` | Calendar arithmetic over integer days. |
| `toLayoutTime`, `toWallMinutes`, `fromLayout`, `dayOf`, `minuteOf` | Date/string conversion and write-back in the original form. |
| `normalizeEvent`, `normalizeEvents`, `isLaneEvent`, `lastDayOf`, `spansMultipleDays` | Validate/repair dates and classify event geometry. |
| `sliceRows`, `sliceColumns`, `assignLanes`, `layoutRow`, `clusterColumns` | Month spans, all-day lanes and timed overlap clusters. |
| `resolveMove`, `resolveResize`, `daySpan` | Proposed move/resize math independent of DOM. |
| `parseTime`, `snapMinutes`, `clampMinutes`, `minutesFromOffset`, `slotCount` | Time-axis, snapping and pointer-offset math. |
| `formatDay`, `formatWall`, `formatDayRange`, `todayDay`, `nowWall` | Explicit-locale labels and zoned current date/time. |

## Initial server data

Fetch the initial range in the route loader. Here both loader and Scheduler use UTC and a Monday week start, so their windows agree. The endpoint is application-owned and should return events overlapping `[start, end)`, including events that began before `start`.

```tsx title="src/routes/schedule.tsx"
import { signal } from "@rivetjs/reactivity";
import { load, type PageProps } from "@rivetjs/router";
import { Scheduler, type SchedulerEvent } from "@rivetjs/cdk/scheduler";
import { computeVisibleRange, fromLayout, toLayoutTime } from "@rivetjs/cdk/scheduler/layout";

export const loader = load(async ({ url, signal }) => {
  const date = url.searchParams.get("date") ?? "2026-10-20";
  const point = toLayoutTime(date, "UTC");
  if (!point) throw new Error("Invalid schedule date");
  const range = computeVisibleRange("week", point.day, 1);
  const endpoint = new URL("/api/events", url);
  endpoint.searchParams.set("start", fromLayout(range.start, 0, date, "UTC", true));
  endpoint.searchParams.set("end", fromLayout(range.end, 0, date, "UTC", true));
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error("Could not load events");
  return { date, events: (await response.json()) as readonly SchedulerEvent[] };
});

export default function Schedule({ data }: PageProps<typeof loader>) {
  const events = signal<readonly SchedulerEvent[]>(data.events);
  return <Scheduler events={events} defaultDate={data.date} defaultView="week"
    timeZone="UTC" firstDayOfWeek="mon" aria-label="Team schedule" />;
}
```

`onVisibleRangeChange` handles later scheduler navigation; it does not emit the initial range or writes made directly to your own date/view signals. Fetch and replace `events` in that callback when using an application endpoint. Guard against stale responses when users navigate quickly. A static site runs its loader at build time; use a server route for request-time data.


## Styling

Headless Scheduler ships state and geometry, so import `@rivetjs/cdk/theme.css` for theme tokens and provide application CSS as in the examples. The theme alone does not lay out the scheduler. Set a time-grid scroller height and keep horizontal overflow within `.rv-SchedulerMonth` / `.rv-SchedulerTimeGrid-scroller`.

| Hooks | Meaning |
| --- | --- |
| `classNames` | `toolbar`, `title`, `grid`, `header`, `cell`, `slot`, `allDay`, `event`, `eventTitle`, `eventTime`, `more`, `morePanel`, `moreOverlay`, `nowLine`, `handle`, `menu`, `menuPopover`; appended to stable `rv-*` classes. |
| Cell state | `data-outside`, `data-today`, `data-weekend`, `data-selected`. |
| Event state | `data-color`, `data-all-day`, `data-timed`, `data-ghost`, `data-dragging`, `data-continues-before`, `data-continues-after`. |
| Geometry | `--rv-scheduler-slot-height`, `--rv-scheduler-lane-height`, `--rv-scheduler-row-min-height`, `--rv-scheduler-column-min-width`, `--rv-scheduler-gutter`. |
| Timed positioning | `--rv-scheduler-event-top`, `--rv-scheduler-event-height`, `--rv-scheduler-event-start`, `--rv-scheduler-event-width`. |
| Lane positioning | `--rv-scheduler-lane`, `--rv-scheduler-span`. |

```css
.rv-SchedulerTimeGrid-slot { height: var(--rv-scheduler-slot-height, 36px); }
.rv-SchedulerMonth { overflow-x: auto; }
.rv-SchedulerMonth-cell[data-selected="true"] { outline: 2px solid currentColor; }
```

## Accessibility and keyboard

Name the root group. Month uses a roving grid; week/day use a named group, an all-day grid and a daily listbox of option slots. Chip labels include dates/times and continuation details. Alternating polite live regions announce edits and navigation. Focus returns to the owning cell when a focused chip is removed. Horizontal navigation and lane resizing follow computed direction, including portaled menu/overflow content.

| Focus | Keys | Action |
| --- | --- | --- |
| Month cell | Arrows; Home/End | Move by day/week; first/last cell in the row. Horizontal arrows follow direction. |
| Month cell | Ctrl+Home/End; PageUp/PageDown | First/last grid cell; previous/next month. |
| Time slot | Arrows; Home/End | Move by slot/day; first/last visible day at the same time. |
| Time slot | Ctrl+Home/End; PageUp/PageDown | First/last slot; previous/next week, or day in day view. |
| Cell or slot | Shift+Arrow; Enter; Escape | Extend a range; commit it; clear it. |
| Cell or slot | Space; Enter | Activate a slot; Enter enters its event/overflow controls first when present. |
| Event | Enter/Space; Escape | Activate; return to its owning cell/slot. |
| Event | Alt+Arrow | Move; timed vertical movement uses snap duration. |
| Event | Alt+Shift+Arrow; Ctrl+Alt+Arrow | Resize the end; resize the start. Timed resizing uses vertical arrows. |
| Event | Delete/Backspace | Request deletion when editable. |
| Event/cell | ContextMenu; Shift+F10 | Open a supplied menu. |
| Event/overflow controls | Tab / Shift+Tab | Move through the active cell's controls. |


## Resumability

Use `DateValueString` data for events and controlled dates: `"2026-10-20"`, `"2026-10-20T09:00"`, or `"2026-10-20T09:00:00+00:00[UTC]"`. These are string forms of `CalendarDate`, `CalendarDateTime` and `ZonedDateTime`. Date-class instances can be used by the pure layout helpers, but do not put unregistered class instances in a user signal that crosses the server boundary.

The server emits final event geometry and month overflow counts. Month view boots no scheduler code at load. Week/day have client effects for initial/imperative scrolling and the visible minute clock; the server renders no now-line. On a static build choose Today to bring the current date into view.

Cold interaction uses derived component adoption and can load the scheduler's static renderer/state/locale/layout closure. The drag engine is dynamically imported on first drag. Current adoption does not meet the historical small-handler or first-drag-only dependency budgets; server rendering of 1,000 visible events also exceeds the original 6 ms target. These limitations do not change the public API. See the repository's [Scheduler performance report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-scheduler.md) for measured conditions and numbers.


## Testing and deviations

The examples use production Chromium checks for controlled view/event writes, move/resize veto feedback, quick/range creation, header navigation and menu actions. The docs runner's single-move drag helper does not exercise a CDK threshold drag; external drops are additionally verified with stepped pointer events against the built demo.

Compared with the source library, dates use CDK date values or strings, edits use wall-clock arithmetic, initial data comes from the loader, and month lane caps are server-determined rather than measured from browser row height. The all-day band grows to fit. Resources/timeline/year/recurrence, print/export, quick-info UI and overnight business hours are outside this implementation.

## API reference

::api{symbol="@rivetjs/cdk/scheduler#Scheduler"}

::api{symbol="@rivetjs/cdk/scheduler#SchedulerProps"}

::api{symbol="@rivetjs/cdk/scheduler/layout#computeVisibleRange"}
