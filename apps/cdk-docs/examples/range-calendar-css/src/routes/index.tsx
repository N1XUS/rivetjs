import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: plain CSS" };

// #region demo
export default function PlainCss() {
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Styled by src/styles.css on the default rv-* classes and data-* states. */}
        <RangeCalendar id="range" aria-label="Stay" defaultValue={{ start: "2026-10-12", end: "2026-10-16" }} isDateUnavailable={(d) => d.day === 22}>
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
        </RangeCalendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
