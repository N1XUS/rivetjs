import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* onChange fires once per completed range, with CalendarDate objects. */}
        <RangeCalendar
          id="range"
          aria-label="Events"
          defaultFocusedValue="2026-10-14"
          onChange={(range) => add("change:" + range.start.toString() + ".." + range.end.toString())}
          onFocusChange={(date) => add("focus:" + date.toString())}
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
        </RangeCalendar>
        <output id="log">{log().join(" ")}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
