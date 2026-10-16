import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, CalendarHeading } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: composed parts" };

// #region demo
export default function Parts() {
  const date = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Meeting" value={date} firstDayOfWeek="mon">
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            {/* CalendarHeading: the month at `offset` (default: the first visible one), with its own format. */}
            <CalendarHeading format={{ month: "short", year: "2-digit" }} />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          {/* Children instead of a render function: CalendarGridHeader + CalendarGridBody. */}
          <CalendarGrid weekdayStyle="short">
            <CalendarGridHeader>{(day: string) => <CalendarHeaderCell class="weekday">{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody class="days">{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGridBody>
          </CalendarGrid>
        </Calendar>
        <output id="value">Selected: {date() ?? "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
