import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: plain CSS" };

// #region demo
export default function PlainCss() {
  const fridays = (d: CalendarDate) => d.toDate("UTC").getUTCDay() === 5;
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Pick-up" defaultValue="2026-10-14" minValue="2026-10-05" isDateUnavailable={fridays}>
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
