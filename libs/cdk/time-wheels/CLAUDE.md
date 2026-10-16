# libs/cdk/time-wheels

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/time-wheels` (+ `/behaviour`) — Rivet-authored: `../wheel-picker` drums over a TimeField / DateField state (2026-10-09). Used by `@rivetjs/ui/time-picker`. Docs: `apps/cdk-docs/content/components/wheel-picker.md#timewheels`, example `wheel-picker-time`.

## API
- `index.tsx`: `TimeWheels(props)` — `state` (else `TimeFieldStateContext`, else `DateFieldStateContext`), `minuteStep` / `secondStep` (1), `loop` (true; AM / PM never loops), `visibleItems`, `autoFocus` (first enabled drum on mount, `clientEffect` + `focusSafely`), `class` / `wheelClass` / `itemClass`, `id`, `aria-label` / `aria-labelledby`. Inner `TimeDrum` component per type (own component: per-drum closures resume).
- `behaviour.ts`: `TimeWheelType` (`hour` / `minute` / `second` / `dayPeriod`), `TIME_WHEEL_TYPES`, `TimeWheelsConfig`, `dayPeriodLabels(locale)`, `timeWheelOptions(type, …)` (h12: 12, 1 … 11; h11 0 … 11; h23 0 … 23; locale digits; minutes / seconds 2-digit), `timeWheelValue`, `isTimeWheelOptionDisabled` (span overlap with min / max, seconds of day), `setTimeWheelValue` (sets every drum field from shown values, clamps, `setValue`).

## Invariants
- Drums = editable time segments in locale order (granularity decides seconds); hour cycle + two-digit hour from the field formatter.
- Empty field: drums show the placeholder; first change completes all fields. Value keeps its type (Time / date-time).
- Stepped drums show the step at or below the field value.
- RTL: group `dir` from locale; numeric drums in an LTR run (`div.rv-TimeWheels-run`, inline `direction:ltr`).

## Tests
`../tests/wheel-picker.browser.test.tsx` (TimeWheels block: en-US, wrap + dayPeriod, segment → drum, empty field, de-DE, seconds + minuteStep, min / max, ar-EG RTL, read-only), `../tests/wheel-picker-ssr.test.ts`.
