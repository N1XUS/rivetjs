import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: commit behaviour" };

type Range = { start: string; end: string } | null;
const text = (range: Range) => (range ? range.start + " → " + range.end : "none");

/** The header and month grid of the three calendars (the parts read the enclosing RangeCalendar). */
function Month() {
  return (
    <>
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
    </>
  );
}

// #region demo
export default function Commit() {
  const select = signal<Range>({ start: "2026-10-05", end: "2026-10-06" });
  const clear = signal<Range>({ start: "2026-10-05", end: "2026-10-06" });
  const reset = signal<Range>({ start: "2026-10-05", end: "2026-10-06" });
  // What happens to a half-made selection when focus leaves the calendar.
  return (
    <I18nProvider locale="en-US">
      <main>
        <div>
          <RangeCalendar id="select" aria-label="select" value={select} commitBehavior="select">
            <Month />
          </RangeCalendar>
          <output id="select-value">select: {text(select())}</output>
        </div>
        <div>
          <RangeCalendar id="clear" aria-label="clear" value={clear} commitBehavior="clear">
            <Month />
          </RangeCalendar>
          <output id="clear-value">clear: {text(clear())}</output>
        </div>
        <div>
          <RangeCalendar id="reset" aria-label="reset" value={reset} commitBehavior="reset">
            <Month />
          </RangeCalendar>
          <output id="reset-value">reset: {text(reset())}</output>
        </div>
        <button class="action" id="elsewhere" type="button">
          Somewhere else
        </button>
      </main>
    </I18nProvider>
  );
}
// #endregion
