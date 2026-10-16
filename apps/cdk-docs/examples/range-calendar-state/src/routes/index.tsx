import { useContext } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, RangeCalendarStateContext, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { selectedDateDescription } from "@rivetjs/cdk/range-calendar/behaviour";
import { clearSelection, focusNextPage, rangeValue } from "@rivetjs/cdk/state/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: state functions" };

// #region demo
/** Reads the enclosing RangeCalendar's state and drives it with the state functions. */
function StayInfo() {
  const state = useContext(RangeCalendarStateContext)!;
  return (
    <footer>
      <p>
        <button class="action" id="next" type="button" onClick={() => focusNextPage(state)}>
          focusNextPage
        </button>{" "}
        <button class="action" id="clear" type="button" onClick={() => clearSelection(state)}>
          clearSelection
        </button>
      </p>
      {/* rangeValue gives CalendarDate objects to compute with. */}
      <output id="nights">Nights: {rangeValue(state) ? rangeValue(state)!.end.compare(rangeValue(state)!.start) : 0}</output>
      <output id="description">{selectedDateDescription(state) || "No selection"}</output>
    </footer>
  );
}

export default function RangeState() {
  return (
    <I18nProvider locale="en-US">
      <main>
        <RangeCalendar id="range" aria-label="Stay" defaultValue={{ start: "2026-10-05", end: "2026-10-09" }}>
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
          <StayInfo />
        </RangeCalendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
