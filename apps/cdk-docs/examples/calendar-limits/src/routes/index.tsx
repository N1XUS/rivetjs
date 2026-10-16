import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: min, max and unavailable dates" };

// #region demo
export default function Booking() {
  // A local const (or an inline arrow) resumes: weekends and the 13th cannot be booked.
  // Dates in a past year (same weekdays as 2026): no cell is ever "Today", so its label is stable.
  const closed = (date: CalendarDate) => date.day === 13 || [0, 6].includes(date.toDate("UTC").getUTCDay());
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Booking" defaultValue="2015-10-14" minValue="2015-10-08" maxValue="2015-11-20" isDateUnavailable={closed}>
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
        </Calendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
