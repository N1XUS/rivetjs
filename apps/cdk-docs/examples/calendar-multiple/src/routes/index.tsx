import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: multiple selection" };

// #region demo
export default function Shifts() {
  // selectionMode="multiple": the signal holds an array of ISO strings.
  const days = signal<string[]>(["2026-10-05", "2026-10-07"]);
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Shifts" selectionMode="multiple" value={days}>
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
        <div>
          <button class="action" id="clear" type="button" onClick={() => days.set([])}>
            Clear all
          </button>
          <output id="value">Days: {days().join(", ") || "none"}</output>
        </div>
      </main>
    </I18nProvider>
  );
}
// #endregion
