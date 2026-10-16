# @rivetjs/cdk/range-calendar
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `RangeCalendar`: re-export of the calendar parts (one implementation in `../calendar/`).

## Entry points
- `@rivetjs/cdk/range-calendar` -> `index.tsx`: `RangeCalendar` + the calendar parts, contexts
- `@rivetjs/cdk/range-calendar/behaviour` -> `behaviour.tsx` (explicit export): re-exports `rangeCalendarProps`, grid / cell props + handlers, `rangeCalendarFocusOut` from `../calendar/behaviour.tsx`

## Rules / Gotchas
- Root `data-commit-behavior` (`commitBehavior` select / clear / reset); range prompts rendered hidden; see ../calendar/CLAUDE.md

## See also
- [../calendar/CLAUDE.md](../calendar/CLAUDE.md), `apps/cdk-docs/content/components/range-calendar.md`
