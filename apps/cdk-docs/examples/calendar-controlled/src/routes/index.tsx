import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: controlled" };

// #region demo
export default function Controlled() {
  // Two-way signals: the selected date and the focused date (which also picks the visible month).
  const date = signal<string | null>("2026-10-14");
  const focused = signal("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Delivery" value={date} focusedValue={focused}>
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
          <p>
            <button class="action" id="halloween" type="button" onClick={() => date.set("2026-10-31")}>
              Select Oct 31
            </button>{" "}
            <button class="action" id="clear" type="button" onClick={() => date.set(null)}>
              Clear
            </button>
          </p>
          <p>
            <button class="action" id="focus-20" type="button" onClick={() => focused.set("2026-10-20")}>
              Focus Oct 20
            </button>{" "}
            <button class="action" id="focus-christmas" type="button" onClick={() => focused.set("2026-12-25")}>
              Focus Dec 25
            </button>
          </p>
          <output id="value">Value: {date() ?? "none"}</output>
          <output id="focused">Focused: {focused()}</output>
        </div>
      </main>
    </I18nProvider>
  );
}
// #endregion
