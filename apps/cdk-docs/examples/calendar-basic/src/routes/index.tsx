import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar" };

// #region demo
export default function EventDate() {
  // The value is the date's ISO string ("2026-10-14"), or null.
  const date = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Event date" value={date}>
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
        <output id="value">Selected: {date() ?? "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
