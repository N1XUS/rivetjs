import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-3), entry]);
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* onChange / onFocusChange get CalendarDate objects; toString() is the ISO form. */}
        <Calendar
          id="cal"
          aria-label="Events"
          defaultValue="2026-10-14"
          onChange={(date) => add("change:" + date.toString())}
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
        </Calendar>
        <output id="log">{log().join(" ")}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
