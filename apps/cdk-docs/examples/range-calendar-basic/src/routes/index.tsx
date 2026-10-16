import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar" };

// #region demo
export default function Trip() {
  // The value is { start, end } of ISO strings, or null.
  const trip = signal<{ start: string; end: string } | null>({ start: "2026-10-05", end: "2026-10-09" });
  return (
    <I18nProvider locale="en-US">
      <main>
        <RangeCalendar id="trip" aria-label="Trip" value={trip}>
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
        <output id="value">{trip() ? trip()!.start + " → " + trip()!.end : "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
