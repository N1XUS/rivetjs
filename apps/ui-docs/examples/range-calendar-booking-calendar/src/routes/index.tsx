// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/booking-calendar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Real-World Example" };

// #region demo
import type { DateValue } from "@rivetjs/cdk/date";

import { getLocalTimeZone, isWeekend, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { useLocale } from "@rivetjs/cdk/i18n";

export function BookingCalendar() {
  const selectedRange = signal<{ start: string; end: string } | null>(null);
  const { locale } = useLocale();
  const blockedDates = [5, 6, 12, 13, 14, 20];

  const isDateUnavailable = (date: DateValue) => {
    return isWeekend(date, locale) || blockedDates.includes(date.day);
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar aria-label="Booking range" isDateUnavailable={isDateUnavailable} minValue={today(getLocalTimeZone())} value={selectedRange}>
        <RangeCalendar.Header>
          <RangeCalendar.Heading />
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>
            {(date) => {
              // Rivet: plain values for the reactive child below (it is captured for resume; date instances are not serializable).
              const isBlocked = !isWeekend(date, locale) && blockedDates.includes(date.day);

              return (
                <RangeCalendar.Cell date={date}>
                  {({ formattedDate, isUnavailable }) => (
                    <>
                      {formattedDate}
                      {() => !isUnavailable() && isBlocked && <RangeCalendar.CellIndicator />}
                    </>
                  )}
                </RangeCalendar.Cell>
              );
            }}
          </RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </RangeCalendar>
      <div class="flex flex-col gap-2 text-center">
        <div class="flex items-center justify-center gap-4 text-xs text-muted">
          <span class="flex items-center gap-1">
            <span class="size-2 rounded-full bg-muted" /> Blocked dates
          </span>
          <span class="flex items-center gap-1">
            <span class="size-2 rounded-full bg-default" /> Weekend/Unavailable
          </span>
        </div>
        {selectedRange() ? (
          <Button size="sm" variant="primary">
            Book {selectedRange()!.start} -&gt; {selectedRange()!.end}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BookingCalendar />
    </div>
  );
}
