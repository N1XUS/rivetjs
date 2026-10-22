# Calendar cell state — lazy per-cell wake (design note)

Lane DIET-STATE item 5 (2026-10-22). Status: design only, no implementation. Input: SCOUT-STATE F1 (calendar bindings 77–84 % of calendar page state), measured on the cdk story app after DIET-STATE patches 01 (module static data refs) + 02 (`renderProps` per-key accessors).

## 1. What ships per cell today (serialized model, lazy rows + DOM-DATA on)

cdk `/calendar` (357 cells over two grids): state 267,922 B raw / 26,568 B br, HTML br 34,137 B.

| what | bytes (raw, exclusive) | per cell |
| --- | --- | --- |
| `CalendarCell$yq3` binding captures (a1: the cell's `values` bag / `cell` object) | 108,322 | 303 |
| `CalendarCell$gma_1` (a0, the `rp` accessors) | 19,564 | 55 |
| 12 `calendarCellProps$*` computed recipes (`isSelected`, `isFocused`, `isHovered`, …, `aria-*`, `data-*` attribute accessors), each 6.3–10.8 KB / 357 | ≈ 85,000 | 238 |
| total cell-attributable | ≈ 213,000 (80 % of state) | ≈ 600 |

Kinds over the page: `R` (row / region refs) 92.8 KB, `f` (function recipes) 81.3 KB, `y` 49.8 KB — almost all cell recipes. Per cell the binding carries: the cell key (`"2026-10-22"` string), ~20 accessor recipes from `calendarCellProps` (`date`, `isDisabled`, `isUnavailable`, `notSelectable`, `isInvalid`, `isSelected`, `isFocused`, `isToday`, `isSelectionStart`, `isSelectionEnd`, `isOutsideVisibleRange`, `isHovered`, `isPressed`, `isFocusVisible`, plus the attribute accessors `aria-disabled` / `aria-selected` / `aria-label` / `aria-describedby` / `tabIndex` / 14 `data-*`), each a `{f: id, a: [captures]}` record over (`state`, `key`, `isOutsideMonth`, `isDisabledProp`, sibling accessors). The cell has no handler of its own: press / hover / focus are delegated on the grid (`calendarGrid*` handlers write `data-pressed` / `data-hovered` / `data-focus-visible`). The bindings wake on 5 shared signals (`[15,18,9,11,12]`: selection value, focused date, hovered / pressed / focus-visible cell).

Why repeated-binding packing (`PackedBindings`, `+`) does not help: it packs bindings whose captures differ only by primitives; each cell captures a distinct chain of recipe objects (one `date` accessor per cell, the others closing over it), so every cell is its own set of table entries.

What the browser needs: a cell's attribute bindings only re-run when one of the 5 shared signals changes; the values they compute are pure functions of (shared calendar state, cell key, `isOutsideMonth`, `isDisabled`). Every one of the ~20 computeds can be rebuilt in the browser from `calendarCellProps({ date: key, isOutsideMonth }, state)`; none holds browser-only state.

## 2. Option A — lazy cell rows (reuse lazy rows)

Treat a grid's cells as a lazy `For`: the cell render function is the row function, the cell key the item, the grid's `state` + month the shared frame (captured once, the `L` entry). Wire per cell = key only (or nothing: keys derive from the month start + index, a `range` form of `[0..n)`).

- Server: `CalendarGrid` renders its weeks through a keyed `<For each={weeks} by={…}>` / `<For each={days} by={cellKey}>` the compiler can prove lazy (`resume/rows.rs` verdict); today the grid builds rows with a plain `.map` (no `For`), so the cells are component bindings. Change cdk `calendar/index.tsx` `CalendarGridBody` to keyed `For`s.
- Browser: a shared-signal change wakes only the rows that read it — needs the keyed selector wake (LAZY-T6 entry `[12]`) for `hoveredCell() === key`, `pressedCell() === key`, `focusVisibleCell() === key`, `isSameDay(date, focusedDate)`: those are keyed reads (one or two rows per change). `isSelected` (range selection) is a plain read: a selection change materialises every cell of the visible months (357 materialisations ≈ the region re-creation cost of the grid; measure: LAZY-T5 measured +5–18 ms at ×4 for a 100-row window on a shared plain read).
- Cost: M (cdk grid → `For` + `by`, keyed reads in `calendarCellProps` through `_trackReads` keyed hook — `isHovered` etc. are `===` against a signal, the keyed selector shape), risk M (RTL / range-selection wake storms, `isOutsideMonth` per-row local).
- Expected: state −200 KB raw / −22 KB br on cdk `/calendar` (measured upper bound in SCOUT-STATE: dropping the bindings + unreachable entries → 7,054 B br); first selection click pays a 357-row materialisation unless the selection read is keyed (`isSelected` over a range is not a single-key selector: a range selector kind would be new).

## 3. Option B — derived per-cell wake (derived model)

The derived model (`resume: { model: "derived" }`) already ships calendar at 31.9 K raw (HTML br 7.7 K vs 38.5 K serialized, SCOUT-STATE): cells are boundaries re-derived from props at interaction time; nothing per cell beyond the boundary record.

- Make the serialized model derive the cell the same way: a `CalendarCell` boundary record `[id, parent, flags, "CalendarCell", { date: key, isOutsideMonth }]` and no bindings; on the first shared-signal write the browser re-runs `CalendarCell` in adopt mode over the server nodes (derived `dom-derived.ts` adopt), which recreates its bindings.
- Cost: L (a serialized-model consumer of the derived boundary records for a component subtree: the two models do not mix today — the serialized client has no adopt path for non-row components), risk M–H (mixing models is new ABI).
- Expected: same bytes as A; CPU on first wake = adopt of every cell that reads the written signal (same storm as A without keyed reads).

## 4. Recommendation

Option A first: it reuses the default serialized model's lazy rows (no new ABI) and the keyed wake that already exists; the cdk change is local to the calendar grid. Add a `range` keyed-read kind only if the selection-click materialisation measures worse than today's resumed click (gate: `/calendar` first click p50 at ×4 not slower than base; state br ≤ 8 KB). Option B is the long-term shape once derived is the default (2026-10-21 ruling: derived = the only resume): then the calendar needs nothing.

## 5. Open questions

- Week rows as `For` change the DOM nesting (`<tr>` per week): keep the grid's table markup identical (no implied `<tbody>`, RV1005).
- `CalendarYearPickerCell` (ui, 200 cells, 136 KB on ui `/calendar`) and range cells follow the same shape: one grid → `For` change covers all three.
