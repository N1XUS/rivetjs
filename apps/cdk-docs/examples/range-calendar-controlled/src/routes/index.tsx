import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: controlled" };

// #region demo
export default function Controlled() {
  // Two-way signals: the range ({ start, end } strings) and the focused date (a string).
  const stay = signal<{ start: string; end: string } | null>(null);
  const focused = signal("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        <RangeCalendar id="stay" aria-label="Stay" value={stay} focusedValue={focused}>
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
        <div>
          <p>
            <button class="action" id="weekend" type="button" onClick={() => stay.set({ start: "2026-10-17", end: "2026-10-18" })}>
              Weekend
            </button>{" "}
            <button class="action" id="week" type="button" onClick={() => stay.set({ start: "2026-10-19", end: "2026-10-23" })}>
              Work week
            </button>{" "}
            <button class="action" id="clear" type="button" onClick={() => stay.set(null)}>
              Clear
            </button>{" "}
            <button class="action" id="focus-21" type="button" onClick={() => focused.set("2026-10-21")}>
              Focus the 21st
            </button>
          </p>
          <output id="value">Stay: {stay() ? stay()!.start + " to " + stay()!.end : "none"}</output>
          <output id="focused">Focused: {focused()}</output>
        </div>
      </main>
    </I18nProvider>
  );
}
// #endregion
