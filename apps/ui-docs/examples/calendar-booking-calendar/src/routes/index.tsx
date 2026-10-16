// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/booking-calendar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Real-World Example" };

// #region demo
import type { DateValue } from "@rivetjs/cdk/date";

import { getLocalTimeZone, isWeekend, today } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";
import { signal } from "@rivetjs/reactivity";

export function BookingCalendar() {
  const selectedDate = signal<string | null>(null);
  const { locale } = useLocale();

  const bookedDates = [5, 6, 12, 13, 14, 20];

  const isDateUnavailable = (date: DateValue) => {
    return isWeekend(date, locale) || bookedDates.includes(date.day);
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Booking date" isDateUnavailable={isDateUnavailable} minValue={today(getLocalTimeZone())} value={selectedDate}>
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => {
              // Rivet: plain values for the reactive child below (it is captured for resume; date instances are not serializable).
              const isBooked = !isWeekend(date, locale) && bookedDates.includes(date.day);

              return (
                <Calendar.Cell date={date}>
                  {({ formattedDate, isUnavailable }) => (
                    <>
                      {formattedDate}
                      {() => !isUnavailable() && isBooked && <Calendar.CellIndicator />}
                    </>
                  )}
                </Calendar.Cell>
              );
            }}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

      <div class="flex flex-col gap-2 text-center">
        <div class="flex items-center justify-center gap-4 text-xs text-muted">
          <span class="flex items-center gap-1">
            <span class="size-2 rounded-full bg-muted" /> Has bookings
          </span>
          <span class="flex items-center gap-1">
            <span class="size-2 rounded-full bg-default" /> Weekend/Unavailable
          </span>
        </div>
        {selectedDate() ? (
          <Button size="sm" variant="primary">
            Book {selectedDate()}
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
