import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: validation" };

// #region demo
export default function Validation() {
  // Saturday 2026-10-17 is unavailable, so this starting value is invalid.
  const date = signal<string | null>("2026-10-17");
  const weekend = (d: CalendarDate) => [0, 6].includes(d.toDate("UTC").getUTCDay());
  return (
    <I18nProvider locale="en-US">
      <main>
        <div>
          <Calendar id="auto" aria-label="Workday" value={date} isDateUnavailable={weekend} maxValue="2026-12-31">
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
            {/* Always rendered; styles.css shows it only while the calendar is [data-invalid]. */}
            <Text slot="errorMessage">Pick a weekday.</Text>
          </Calendar>
          <button class="action" id="weekend" type="button" onClick={() => date.set("2026-10-18")}>
            Set a Sunday
          </button>
        </div>
        {/* isInvalid: application logic (a server answer) marks the selection invalid. */}
        <Calendar id="forced" aria-label="Forced" defaultValue="2026-10-14" isInvalid>
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
          <Text slot="errorMessage">Rejected by the server.</Text>
        </Calendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
