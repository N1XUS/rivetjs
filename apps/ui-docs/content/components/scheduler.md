---
title: Scheduler
description: "Plan events in month, week and day views, with all-day lanes, drag and resize, keyboard selection and localized controls."
template: reference
status: experimental
related: [components/calendar, components/date-picker, components/dropdown]
---

`Scheduler` displays events in a month calendar or a week/day time grid. The server places the events, labels and overflow counts. Users can navigate with the keyboard, move and resize events, select a range, and open event or slot menus.

:::note
Scheduler is a Rivet addition, independently implemented. Scheduler behavior is adapted from the Rivet author's own MIT-licensed scheduler library. See [licenses and attribution](/start/licenses/#scheduler).
:::

## Usage

```tsx
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
import { signal } from "@rivetjs/reactivity";

export default function Schedule() {
  const events = signal<readonly SchedulerEvent[]>([
    {
      id: "review",
      title: "Design review",
      start: "2026-10-19T09:00",
      end: "2026-10-19T10:00",
      color: "accent",
    },
  ]);
  return <Scheduler events={events} defaultDate="2026-10-19" timeZone="UTC" aria-label="Team schedule" />;
}
```

Use date strings for data that crosses the server boundary. `events` accepts a two-way signal, a controlled array or an accessor. Moves and resizes write a new array to a signal; for a controlled value, save the array passed to `onEventsChange`.

All event and selection ranges have an **exclusive end**. An all-day event starting on Monday and ending on Wednesday occupies Monday and Tuesday. Give every event a unique stable `id`.

## Views

::example{id=scheduler-views}

The default view is `month`; `week` and `day` share a scrolling time grid. `view` and `date` can be two-way signals. `defaultView` and `defaultDate` set initial values. The toolbar exposes previous, next, Today and view controls. `toolbar={false}` hides the default controls; `renderHeader` supplies your own.

::example{id=scheduler-views-binding}

## Events

::example{id=scheduler-events}

Each event needs `id`, `title`, `start` and `end`. Semantic `color` values are `default`, `accent`, `success`, `warning` and `danger`; `cssColor` supplies a custom color. `data` holds application-specific information. Use `renderEvent(event, state)` to replace a chip's contents while keeping its interaction and accessible label.

::example{id=scheduler-custom-event}

Unconfirmed and read-only events need no extra fields: keep a status in `data` and let `renderEvent` render a marker that your CSS keys on (here a dashed, transparent chip), and set `isDraggable: false` / `isResizable: false` on an event that must not change; it stays selectable and activatable.

::example{id=scheduler-event-status}

## Drag Interactions

::example{id=scheduler-drag}

Drag an event to change its start, or use either resize edge to change its range. `snapDuration` controls snapping; it defaults to `slotDuration`. Touch gestures wait briefly before dragging so a swipe can still scroll the time grid. Escape cancels a gesture.

`canMove(event, next)` and `canResize(event, next)` veto a proposed change by returning `false`. Successful commits emit `onEventMove` or `onEventResize`; `isReadOnly` turns editing off. Per-event `isDraggable` and `isResizable` control the affordances independently.

::example{id=scheduler-drag-vetoes}

## All-Day Events

::example{id=scheduler-all-day}

Set `allDay: true` and use date-only strings for whole-day events. Long timed events also use spanning lanes; shorter midnight-crossing events are split over the relevant time-grid days. The month lays out lanes per week, while the time grid's all-day band grows to fit its events.

::example{id=scheduler-all-day-spans}

## Month View Features

::example{id=scheduler-month-features}

`showWeekNumbers` adds an ISO week-number column. `visibleLanes` caps month lanes; overflow appears in the `+N more` panel. The automatic cap follows density: compact, default and comfortable use three, four and five lanes. Explicit numeric caps win. `onMoreAction` receives the hidden events for the opened day.

The lane cap is determined on the server. It does not measure the browser's available row height. A spanning event continues across cells and splits at week boundaries.

To open a day from the month grid, bind `view` and `date` to signals and switch them in `onSlotAction` (a click, Enter or Space on a day).

::example{id=scheduler-date-navigation}

## Weekend Highlighting

::example{id=scheduler-weekend}

Weekends follow the locale unless `weekendDays` supplies weekday numbers (`0` is Sunday). `hiddenDays` removes weekdays from the displayed month/week. Day view can still show an explicitly chosen hidden weekday; stepping through days skips hidden weekdays.

## Current Time Indicator

::example{id=scheduler-current-time}

`showCurrentTime` controls the today marker and time-grid now line. The line appears only when today and the current time are inside the visible range. Use Today in a static docs example to bring the current date into view. `scrollToCurrentTime` centers the initial time-grid scroll on now; it is off by default.

## Working hours

::example{id=scheduler-working-hours}

`minTime` and `maxTime` define the visible axis (`"00:00"` through `"24:00"`). The minimum must be earlier than the maximum. `slotDuration` sets row size in minutes. `businessHours={{ start: "09:00", end: "17:00" }}` shades outside working hours; days default to Monday–Friday. Shading is guidance and does not itself veto edits. Overnight business windows are not supported.

## Custom header and external drop

::example{id=scheduler-custom-header-external-drop}

`renderHeader(api)` receives localized title/view/range accessors, translated labels and navigation methods: `next`, `previous`, `today`, `setView` and `goTo`. Its output remains reactive. A supplied header takes precedence over the default toolbar.

With `onExternalDrop`, the scheduler body is a CDK drop target. Connect an external `DropList` to the scheduler's `dropGroup` (default `"rv-scheduler"`) or share a `DropListGroup`. The callback receives the item's data and the proposed end-exclusive date range. The scheduler returns the original item to its list; create a new event in application state. An empty `DragPlaceholder` is useful for external lists; the scheduler also prevents a default foreign placeholder from stretching its hit area.

## Range selection, density and locale

::example{id=scheduler-range-density-locale}

Drag empty cells/slots, or use Shift+Arrow then Enter, to emit `onRangeSelect`. Month/all-day ranges select whole days; time-grid ranges use the rendered slots. `allowsRangeSelection={false}` disables range selection independently of editing.

`density` controls slot/lane heights, cell spacing and automatic month lanes. `variant="secondary"` changes the surface. Locale controls names, time formatting, first weekday and weekend defaults. Set `firstDayOfWeek`, `weekendDays` or `strings` to override them. `timeZone` controls zoned input conversion; pass it explicitly for server rendering. Without it the server uses UTC, and a resumed page keeps that zone.

## Context menus

::example{id=scheduler-context-menus}

`renderEventMenu(event, context)` and `renderSlotMenu(range, context)` return menu items, such as `Dropdown.Item`. The scheduler supplies the non-modal popover and menu. Right-click, ContextMenu or Shift+F10 opens it; Escape closes it and restores focus. Scrolling an ancestor closes a menu when its anchor moves; a queued scroll from before opening does not dismiss a menu already at its final anchor. Slot menus receive the selected range when opened inside a pending keyboard selection. `context.close()` dismisses the menu.

## Accessibility and keyboard

Give the root group a useful accessible name. Month uses a roving grid; week/day use an all-day grid and one listbox of slots per day. Chip labels include dates/times and continuation information; move/resize/navigation results are announced through alternating polite live regions. Focus returns to the owning cell after Escape or event removal.


| Focus | Keys | Action |
| --- | --- | --- |
| Month cell | Arrows; Home/End | Move by day/week; first/last cell in the row. Horizontal keys follow direction. |
| Month cell | Ctrl+Home/End; PageUp/PageDown | First/last grid cell; previous/next month. |
| Time slot | Arrows; Home/End | Move by slot/day; first/last visible day at the same time. |
| Time slot | Ctrl+Home/End; PageUp/PageDown | First/last slot; previous/next week (one day in day view). |
| Cell or slot | Shift+Arrow; Enter; Escape | Extend a range; commit it; clear it. |
| Cell or slot | Space; Enter | Activate a slot; Enter first enters its event/overflow controls when present. |
| Event | Enter/Space; Escape | Activate; return to the owning cell. |
| Event | Alt+Arrow | Move the event. |
| Event | Alt+Shift+Arrow; Ctrl+Alt+Arrow | Resize the end; resize the start. Timed resize uses vertical arrows. |
| Event | Delete/Backspace | Emit `onEventDelete` when editable; application code removes it. |
| Event/cell | ContextMenu or Shift+F10 | Open a supplied context menu. |

## Server data

Fetch the initial range in the route loader. Here both loader and Scheduler use UTC and a Monday week start, so their windows agree. The endpoint is application-owned and should return events overlapping `[start, end)`, including events that began before `start`.

```tsx title="src/routes/schedule.tsx"
import { signal } from "@rivetjs/reactivity";
import { load, type PageProps } from "@rivetjs/router";
import { Scheduler, type SchedulerEvent } from "@rivetjs/ui/scheduler";
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

## Resumability

Use `DateValueString` data for events and controlled dates: `"2026-10-20"`, `"2026-10-20T09:00"`, or `"2026-10-20T09:00:00+00:00[UTC]"`. These are string forms of `CalendarDate`, `CalendarDateTime` and `ZonedDateTime`. Date-class instances can be used by the pure layout helpers, but do not put unregistered class instances in a user signal that crosses the server boundary.

The server emits final event geometry and month overflow counts. Month view boots no scheduler code at load. Week/day have client effects for initial/imperative scrolling and the visible minute clock; the server renders no now-line. On a static build choose Today to bring the current date into view.

Cold interaction uses derived component adoption and can load the scheduler's static renderer/state/locale/layout closure. The drag engine is dynamically imported on first drag. Current adoption does not meet the historical small-handler or first-drag-only dependency budgets; server rendering of 1,000 visible events also exceeds the original 6 ms target. These limitations do not change the public API. See the repository's [Scheduler performance report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-scheduler.md) for measured conditions and numbers.

## Styling reference

- `schedulerVariants` exposes the named slots; `classNames` merges caller classes into them. `class` and `classNames.base` style the root.
- Slots: `base`, `toolbar`, `title`, `grid`, `header`, `cell`, `slot`, `allDay`, `event`, `eventTitle`, `eventTime`, `more`, `morePanel`, `nowLine`, `handle`, `menu`, plus portaled `moreOverlay` and `menuPopover`.
- Root: `data-slot="scheduler"`, `data-view`, `data-density`, `data-dragging`. Cells expose today, outside-month, weekend and selection state; events expose color, all-day/timed, ghost, spanning and continuation state.
- Geometry variables include `--rv-scheduler-slot-height`, `--rv-scheduler-lane-height`, `--rv-scheduler-row-min-height`, `--rv-scheduler-column-min-width` and `--rv-scheduler-gutter`. Prefer density and lane props before overriding geometry.

## API Reference

### Props

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
| `visibleLanes` | `number`, `"auto"` or accessor | density: compact 3, default 4, comfortable 5 | Month cap; all-day time-grid lanes always grow to fit. |
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

| UI prop | Type | Default | Behavior |
| --- | --- | --- | --- |
| `density` | `compact`, `default`, `comfortable` | `default` | Geometry and automatic month lane cap. |
| `variant` | `default`, `secondary` | `default` | Surface treatment. |

`classNames.base` styles the root in addition to the named CDK parts.

### Event model

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

### Callbacks

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

### Header and state APIs

`SchedulerHeaderApi` exposes `title()`, `view()`, `range()`, localized `labels` accessors and `next()`, `previous()`, `today()`, `setView(view)`, `goTo(date)`. For controls outside a render header, obtain state with `stateRef` and import `schedulerNext`, `schedulerPrevious`, `schedulerToday`, `schedulerGoTo`, `schedulerSetView`, `schedulerScrollToTime`, `schedulerTitle` and `schedulerVisibleRange` from `@rivetjs/cdk/scheduler`. Scroll requests apply to a settled time-grid view and are dropped in month view.


::api{symbol="@rivetjs/ui/scheduler#Scheduler"}
