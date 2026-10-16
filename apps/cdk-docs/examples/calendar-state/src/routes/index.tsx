import { useContext } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid, CalendarStateContext } from "@rivetjs/cdk/calendar";
import { selectedDateDescription } from "@rivetjs/cdk/calendar/behaviour";
import { focusNextPage, focusPreviousPage, focusedDate, setValue, focusSectionStart } from "@rivetjs/cdk/state/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: state" };

// #region demo
/** Any component inside a Calendar reads its state from CalendarStateContext. */
function Toolbar() {
  const state = useContext(CalendarStateContext)!;
  return (
    <div class="toolbar">
      <p>
        {/* React Stately's methods are functions taking the state first. */}
        <button class="action" id="prev" type="button" onClick={() => focusPreviousPage(state)}>
          focusPreviousPage
        </button>{" "}
        <button class="action" id="next" type="button" onClick={() => focusNextPage(state)}>
          focusNextPage
        </button>{" "}
        <button class="action" id="start" type="button" onClick={() => focusSectionStart(state)}>
          focusSectionStart
        </button>
      </p>
      <p>
        <button class="action" id="select-focused" type="button" onClick={() => setValue(state, focusedDate(state))}>
          setValue(focusedDate)
        </button>{" "}
        <button class="action" id="clear" type="button" onClick={() => setValue(state, null)}>
          setValue(null)
        </button>
      </p>
      {/* The state is signals: reads are reactive. */}
      <output id="value">value: {state.value() ?? "none"}</output>
      <output id="focused">focused: {state.focused()}</output>
      <output id="description">{selectedDateDescription(state) || "No selection"}</output>
    </div>
  );
}

export default function StateDriven() {
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Custom" defaultValue="2026-10-14">
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
          <Toolbar />
        </Calendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
