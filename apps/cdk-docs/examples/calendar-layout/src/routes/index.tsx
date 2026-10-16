import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: weeks and weekday names" };

// #region demo
export default function Layout() {
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Weeks start on Monday whatever the locale says; short weekday names. */}
        <Calendar id="mon" aria-label="Monday first" defaultValue="2026-10-14" firstDayOfWeek="mon">
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid weekdayStyle="short">{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
        </Calendar>
        {/* Always six rows, so the height never jumps between months; long weekday names. */}
        <Calendar id="six" aria-label="Six weeks" defaultValue="2026-02-14" weeksInMonth={6}>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid weekdayStyle="long">{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
        </Calendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
