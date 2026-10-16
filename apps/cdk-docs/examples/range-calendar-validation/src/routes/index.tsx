import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: validation" };

// #region demo
export default function TripDates() {
  // The initial range ends on a booked day: invalid until a valid range is picked.
  const trip = signal<{ start: string; end: string } | null>({ start: "2026-10-12", end: "2026-10-16" });
  return (
    <I18nProvider locale="en-US">
      <main>
        <RangeCalendar
          id="trip"
          aria-label="Trip dates"
          value={trip}
          minValue="2026-10-03"
          // Booked days are unavailable; once a start is picked, so is every day more than a week away from it.
          isDateUnavailable={(date: CalendarDate, anchorDate: CalendarDate | null) =>
            (anchorDate !== null && Math.abs(date.compare(anchorDate)) > 7) ||
            (date.month === 10 && ((date.day >= 15 && date.day <= 17) || date.day === 23 || date.day === 24))
          }
        >
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          <Text slot="errorMessage">October 15 to 17, 23 and 24 are booked.</Text>
        </RangeCalendar>
        <output id="value">{trip() ? trip()!.start + " → " + trip()!.end : "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
