import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";
import { Custom454 } from "../components/Custom454.ts";

export const head = { title: "Calendar: custom calendar system" };

// #region demo
export default function Fiscal() {
  const date = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* createCalendar: an inline arrow (resumable) returning the custom system. */}
        <Calendar id="cal" aria-label="Fiscal date" value={date} firstDayOfWeek="sun" createCalendar={() => new Custom454()}>
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
        {/* The signal holds the Gregorian ISO string. */}
        <output id="value">Selected: {date() ?? "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
