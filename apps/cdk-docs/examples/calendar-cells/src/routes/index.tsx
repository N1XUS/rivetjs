import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: cell render props" };

// #region demo
export default function Cells() {
  const date = signal<string | null>("2026-10-14");
  // Days with events: strings, so the closures below stay serializable.
  const events = ["2026-10-08", "2026-10-14", "2026-10-23"];
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Agenda" value={date}>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid>
            {(day: CalendarDate) => (
              <CalendarCell
                date={day}
                // Render props are accessors: call them in the class / style / children functions.
                class={({ isSelected, isOutsideMonth }) => "rv-CalendarCell day" + (isSelected() ? " picked" : "") + (isOutsideMonth() ? " other" : "")}
              >
                {({ formattedDate, date, isSelected }) => (
                  <>
                    <span class="number">{formattedDate}</span>
                    {events.includes(date().toString()) ? <span class={isSelected() ? "dot on" : "dot"} aria-hidden="true"></span> : null}
                  </>
                )}
              </CalendarCell>
            )}
          </CalendarGrid>
        </Calendar>
        <output id="value">Selected: {date() ?? "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
