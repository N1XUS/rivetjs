# libs/cdk/wheel-picker

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/wheel-picker` (+ `/behaviour`) — Rivet-authored (no React Aria / Angular CDK counterpart; 2026-10-09, user: "time picker … carousel drums for time? looped"). iOS-style scroll wheel drums on the house motion `../motion` (embla physics). Consumers: `../time-wheels` (TimeField drums), `@rivetjs/ui/time-picker`. Docs `apps/cdk-docs/content/components/wheel-picker.md`, examples `wheel-picker-{basic,time}`.

## API
- `index.tsx`: `Wheel<V>(props)` (one drum = `div[role=spinbutton].rv-Wheel` + items `div[data-rv-wheel-item].rv-WheelItem`), `WheelPicker` (`div[role=group].rv-WheelPicker`, inline `display:flex`). Props: `options`, `value` / `defaultValue` / `onChange`, `loop`, `isOptionDisabled`, `isDisabled`, `isReadOnly`, `visibleItems` (5), `pageStep` (5), `state` (external `createWheelState`), `class` / `itemClass`, `children(option, index)`, `id`, aria label / labelledby / describedby, `data-type`.
- `behaviour.ts`: `createWheelState(options)` → `WheelState` (`selected` = `controllable`, `position: Signal<number | null>` items while moving, `null` at rest); pure `wheelLoops(count, loop, visible)` (loop only when count ≥ visible + 2), `wheelOffset`, `wheelSelectedIndex`, `wheelPosition`, `wheelCenterIndex`, `isWheelOptionDisabled`, `wheelNearestEnabled`, `wheelItemStyle`, `wheelStyle`; actions `wheelSelectIndex`, `wheelFollow`; handlers `wheelPointerDown`, `wheelArm`, `wheelWheel`, `wheelKeyDown`, `wheelDispose`; constants `WHEEL_DRAG_THRESHOLD` (4 px), `WHEEL_RUBBER_BAND` (0.2), `WHEEL_SNAP_DELAY` (120 ms).

## Invariants
- Units = items (embla math scale-invariant except the 0.001 settle threshold). Items `position:absolute; top:50%` + inline `translateY(calc((d - 0.5) * 100%))`: no measurement, same markup on server; `--rv-wheel-offset` / `--rv-wheel-distance` for looks; items beyond visible / 2 + 1 `visibility:hidden`.
- State plain signals (resumable); Motion1D / pointer / wheel timer in a module WeakMap keyed by state, created on first interaction. onChange fires once per decided value, never per frame.
- Release: VelocityTracker force × `DragRelease(true, 0.68)` free boost (500 mouse / 600 touch) → nearest enabled item → `settle`. Reduced motion (`prefers-reduced-motion`) jumps.
- Wheel: line / page deltaMode or |delta| ≥ 50 = one-item notch; smaller = continuous drag + snap 120 ms after last event.
- Disabled options skipped by step / spin / type-ahead (`wheelNearestEnabled`).
- Attributes in expression form (`aria-valuenow={valueNow(state)}`), never `attr={() => …}` (renders as text on the server).

## Tests
`../tests/wheel-picker.browser.test.tsx` (Chromium: offsets, a11y, keys + wrap, type-ahead, disabled, notch / trackpad wheel, drag settle, flick, tap, reduced motion, follow, shared state, TimeWheels suite), `../tests/wheel-picker-ssr.test.ts` (server markup + resumable). Docs examples via `check-examples`.

## Gotchas
- Delegated / resumed `wheel` listeners are passive (cannot `preventDefault`): `wheelArm` adds a non-passive per-element listener — from a client render's effect, or on a resumed page on first pointerover / pointerdown / keydown. A test dispatching `wheel` right after mount must `await flush()` first.
- Not yet: date drums, 3D cylinder transform.
