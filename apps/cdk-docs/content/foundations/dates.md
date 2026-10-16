---
title: Dates
description: Calendar-aware date values from @rivetjs/cdk/date, a port of @internationalized/date - CalendarDate, time zones, calendar systems, string forms for state.
template: guide
status: experimental
related: [components/date-picker, foundations/i18n, foundations/utilities]
---

`@rivetjs/cdk/date` is a port of `@internationalized/date`, the value library behind React Aria's date components: immutable date and time objects, arithmetic that respects month lengths and daylight saving time, thirteen calendar systems, and locale-aware queries. The [DatePicker](../components/date-picker.md) and calendar components take and return these values. Rivet adds string forms for resumable state.

::example{id=date-arithmetic}

## Import

```ts
import { CalendarDate, parseDate, today, getLocalTimeZone, toCalendar, createCalendar, DateFormatter, stringifyDateValue, parseDateValue } from "@rivetjs/cdk/date";
```

## Value types

| Class | Holds | Create with |
| --- | --- | --- |
| `CalendarDate` | A date without time (`calendar`, `era`, `year`, `month`, `day`). | `new CalendarDate(2026, 1, 15)`, `new CalendarDate(calendar, era?, year, month, day)`, `parseDate("2026-01-15")`, `today(timeZone)` |
| `CalendarDateTime` | Date and time without a time zone. | `new CalendarDateTime(2026, 1, 15, 9, 30)`, `parseDateTime("2026-01-15T09:30")` |
| `ZonedDateTime` | Date and time in a time zone, with its UTC `offset`. | `parseZonedDateTime("2026-03-29T01:30[Europe/Berlin]")`, `parseAbsolute(iso, timeZone)`, `parseAbsoluteToLocal(iso)`, `now(timeZone)`, `fromDate(date, timeZone)` |
| `Time` | A clock time (`hour`, `minute`, `second`, `millisecond`). | `new Time(9, 30)`, `parseTime("09:30")` |

`DateValue` is `CalendarDate | CalendarDateTime | ZonedDateTime`. Every value is immutable; methods return new values:

| Method | Does |
| --- | --- |
| `add(duration)`, `subtract(duration)` | `{ years, months, weeks, days, hours, minutes, seconds, milliseconds }`. Out-of-range days are constrained (Jan 31 + 1 month = Feb 28). |
| `set(fields)` | Sets fields; others are constrained. `ZonedDateTime.set(fields, disambiguation?)`. |
| `cycle(field, amount, options?)` | Moves one field and wraps at its limits (`{ round }`; time fields also `{ hourCycle: 12 \| 24 }`). This is what date field segments do on arrow keys. |
| `compare(other)` | Negative, zero or positive. |
| `toDate(timeZone)` | A native `Date` (`ZonedDateTime.toDate()` needs no zone). |
| `toString()` | ISO 8601. |
| `copy()` | A copy. |
| `ZonedDateTime.toAbsoluteString()` | UTC ISO string. |

## Functions

| Group | Exports |
| --- | --- |
| Parse | `parseDate`, `parseDateTime`, `parseTime`, `parseZonedDateTime(value, disambiguation?)`, `parseAbsolute(value, timeZone)`, `parseAbsoluteToLocal`, `parseDuration` (ISO 8601 `P1DT2H` → all fields) |
| Convert | `toCalendarDate`, `toCalendarDateTime(date, time?)`, `toTime`, `toCalendar(date, calendar)`, `toZoned(date, timeZone, disambiguation?)`, `toTimeZone(date, timeZone)`, `toLocalTimeZone`, `fromDate`, `fromDateToLocal`, `fromAbsolute(ms, timeZone)` |
| Compare | `isSameDay`, `isSameMonth`, `isSameYear` (across calendars), `isEqualDay`, `isEqualMonth`, `isEqualYear` (same calendar too), `isEqualCalendar`, `isToday(date, timeZone)`, `minDate`, `maxDate` |
| Weeks and months | `startOfWeek(date, locale, firstDayOfWeek?)`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `startOfYear`, `endOfYear`, `getWeeksInMonth(date, locale, firstDayOfWeek?)`, `getDayOfWeek(date, locale, firstDayOfWeek?)` (0 = the locale's first day), `getMinimumMonthInYear`, `getMinimumDayInMonth` |
| Locale | `isWeekend(date, locale)`, `isWeekday(date, locale)` (by the locale's weekend days) |
| Now and zones | `today(timeZone)`, `now(timeZone)`, `getLocalTimeZone()`, `setLocalTimeZone(tz)`, `resetLocalTimeZone()`, `getHoursInDay(date, timeZone)` (23 or 25 on DST changes) |
| Format | `DateFormatter(locale, options)`: `format`, `formatToParts`, `formatRange`, `formatRangeToParts`, `resolvedOptions`, with fixes for browser `hourCycle` bugs. Cached instances: [`getDateFormatter`](i18n.md). |
| State (Rivet) | `stringifyDateValue(value)`, `parseDateValue(text, calendars?)`, `toDateValueString(valueOrString)` |

Types: `AnyCalendarDate`, `AnyTime`, `AnyDateTime`, `Calendar`, `CalendarIdentifier`, `DateDuration`, `TimeDuration`, `DateTimeDuration`, `DateFields`, `TimeFields`, `DateField`, `TimeField`, `Disambiguation` (`compatible`, `earlier`, `later`, `reject`), `CycleOptions`, `CycleTimeOptions`, `DayOfWeek`, `DateValue`, `AnyDateValue`, `AnyTimeValue`, `DateValueString`.

## Calendar systems

`createCalendar(identifier)` returns `GregorianCalendar`, `JapaneseCalendar`, `BuddhistCalendar`, `TaiwanCalendar` (`roc`), `PersianCalendar`, `IndianCalendar`, `IslamicCivilCalendar`, `IslamicTabularCalendar` (`islamic-tbla`), `IslamicUmalquraCalendar`, `HebrewCalendar`, `EthiopicCalendar`, `EthiopicAmeteAlemCalendar` (`ethioaa`) or `CopticCalendar`. Other identifiers (`chinese`, `dangi`, `islamic`, `islamic-rgsa`, `iso8601`) fall back to Gregorian. Each class is exported, so a bundle can include only the calendars it uses.

::example{id=date-calendars}

## Values in state

The resume format refuses class instances, so keep the string form in signals and parse it where you need the object: `stringifyDateValue` returns ISO 8601 plus a `[u-ca=…]` annotation for non-Gregorian calendars, and `parseDateValue` returns an equal value of the same class and calendar (cached, values are immutable). Component props accept either form; `toDateValueString` normalizes them.

::example{id=date-serialize}

## Upstream

`@internationalized/date` (react-spectrum), ported file by file with its test suite (`libs/cdk/tests/date`). Changes: `.ts` import specifiers and strict types only. Rivet adds `stringifyDateValue`, `parseDateValue`, `toDateValueString`. Not ported: nothing from the public API.

## Common mistakes

- **Native `Date` for calendar dates.** A `Date` is an instant; "January 15" shifts by a day across time zones. Use `CalendarDate`.
- **`new Date()` on the server.** `today(getLocalTimeZone())` on the server is the server's day. Pass the visitor's time zone, or compute "today" in the browser.
- **A `CalendarDate` in a signal on a server-rendered page.** Store `stringifyDateValue(value)` instead.
- **Comparing with `===`.** Values are objects; use `compare()` or `isSameDay()`.
