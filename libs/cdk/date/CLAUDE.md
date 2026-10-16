# @rivetjs/cdk/date
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@internationalized/date` port (date values, calendar systems, arithmetic, parsing, formatting) + Rivet string serialization for resumable state. Pure, server-safe; no components.

## Entry points
- `@rivetjs/cdk/date` -> `index.ts` (explicit package.json entry), same surface as upstream `src/index.ts`:
  - classes: `CalendarDate`, `CalendarDateTime`, `Time`, `ZonedDateTime`, `DateFormatter`
  - calendars: `GregorianCalendar`, `JapaneseCalendar`, `BuddhistCalendar`, `TaiwanCalendar`, `PersianCalendar`, `IndianCalendar`, `IslamicCivilCalendar` / `IslamicTabularCalendar` / `IslamicUmalquraCalendar`, `HebrewCalendar`, `EthiopicCalendar` / `EthiopicAmeteAlemCalendar` / `CopticCalendar`, `createCalendar`
  - conversion: `toCalendarDate`, `toCalendarDateTime`, `toTime`, `toCalendar`, `toZoned`, `toTimeZone`, `toLocalTimeZone`, `fromDate`, `fromDateToLocal`, `fromAbsolute`
  - queries: `isSameDay/Month/Year`, `isEqualDay/Month/Year`, `isToday`, `getDayOfWeek`, `now`, `today`, `startOf*/endOf*` (Month/Week/Year), `getWeeksInMonth`, `minDate`, `maxDate`, `isWeekend`, `isWeekday`, `getLocalTimeZone` / `setLocalTimeZone` / `resetLocalTimeZone`, `isEqualCalendar`, …
  - parsing: `parseDate`, `parseDateTime`, `parseTime`, `parseAbsolute`, `parseAbsoluteToLocal`, `parseZonedDateTime`, `parseDuration`
  - Rivet addition: `stringifyDateValue`, `parseDateValue`, `toDateValueString`; types `AnyDateValue`, `AnyTimeValue`, `DateValueString`
  - types: `DateValue`, `Calendar`, `CalendarIdentifier`, `DateDuration`, `TimeDuration`, `DateFields`, `DayOfWeek`, …

## Layout
- `index.ts` - barrel (upstream `src/index.ts` + serialize exports)
- `CalendarDate.ts` - the four value classes
- `calendars/*.ts` - one file per calendar system (Gregorian, Japanese, Buddhist, Taiwan, Persian, Indian, Islamic, Hebrew, Ethiopic)
- `createCalendar.ts` - identifier -> calendar instance (pulls every system in)
- `conversion.ts`, `manipulation.ts`, `queries.ts`, `string.ts`, `DateFormatter.ts`, `types.ts`, `utils.ts`, `weekStartData.ts` - upstream modules 1:1
- `serialize.ts` - Rivet addition: value <-> string with RFC 9557 `[u-ca=<id>]` annotation for non-Gregorian
- tests: `tests/date/{conversion,manipulation,queries,string,DateFormatter,ZonedDateTime}.test.ts` (upstream suites verbatim, `@ts-nocheck`, Jest globals from `@rivetjs/testing/jest`), `tests/date/customCalendarImpl.ts` (helper); serialize covered indirectly by `tests-components/calendar-{keyboard,parts}.test.ts`
- docs examples: `apps/cdk-docs/examples/date-{arithmetic,calendars,serialize}/`

## Upstream
- react-spectrum `packages/@internationalized/date/src/*` (Apache-2.0, © Adobe)
- Changes (every file header): `.ts` import specifiers, type-only imports, `override` modifiers, strict-mode index types. No behaviour changes.
- `serialize.ts` is not upstream (Rivet addition)

## Rules / invariants
- Keep upstream files 1:1; Rivet-only code goes in `serialize.ts` (or new clearly-marked files)
- Widget state stores dates as `DateValueString`, never class instances (resume format refuses class instances); components accept value or string (`toDateValueString`) and read back with `parseDateValue`
- String form = `value.toString()` (ISO 8601, always proleptic Gregorian) + `[u-ca=<id>]` when `calendar.identifier !== "gregory"`; `parseDateValue` restores same class + same calendar
- `parseDateValue` caches results (values immutable; cache cleared above 512 entries); no cache when a custom `calendars` factory is passed
- Shape detection in `parseDateValue`: `[` -> zoned, `T` -> date-time, `^\d{2}:` -> time, else date

## Commands
- `npx vitest run --project cdk libs/cdk/tests/date`
- one suite: `npx vitest run --project cdk libs/cdk/tests/date/queries.test.ts`

## Gotchas
- `createCalendar` imported from here and passed directly as a component prop is not resumable (module-level/imported functions not serializable) - wrap in a local const (gaps.md resume entry)
- `createCalendar` bundles every calendar system; pass a custom factory to ship fewer
- `setLocalTimeZone` is module-global state (upstream behaviour) - affects server renders of every request

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/foundations/dates.md`
- [../calendar/CLAUDE.md](../calendar/CLAUDE.md), [../date-field/CLAUDE.md](../date-field/CLAUDE.md), [../date-picker/CLAUDE.md](../date-picker/CLAUDE.md)
