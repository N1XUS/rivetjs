import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { RangeCalendar, CalendarCell, CalendarGrid, CalendarHeading } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: several months" };

// #region demo
export default function Months() {
  const holiday = signal<{ start: string; end: string } | null>({ start: "2026-10-26", end: "2026-11-06" });
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Two months, paged one at a time; a range may cross the month boundary. */}
        <RangeCalendar id="holiday" aria-label="Holiday" value={holiday} visibleDuration={{ months: 2 }} pageBehavior="single">
          <div class="months">
            <div class="month">
              <header>
                <Button slot="previous">
                  <Icon icon={ChevronLeft} />
                </Button>
                <CalendarHeading />
              </header>
              <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            </div>
            <div class="month">
              <header>
                <CalendarHeading offset={{ months: 1 }} />
                <Button slot="next">
                  <Icon icon={ChevronRight} />
                </Button>
              </header>
              <CalendarGrid offset={{ months: 1 }}>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            </div>
          </div>
        </RangeCalendar>
        <output id="value">{holiday() ? holiday()!.start + " → " + holiday()!.end : "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
