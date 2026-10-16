import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Calendar, CalendarCell, CalendarGrid, CalendarMonthPicker, CalendarYearPicker, type CalendarPickerAria } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: month and year pickers" };

// #region demo
export default function Pickers() {
  const date = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        <Calendar id="cal" aria-label="Birthday" value={date}>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            {/* The render function gets { "aria-label", value(), onChange, items() }: here a native select. */}
            <CalendarMonthPicker>
              {(picker: CalendarPickerAria) => (
                <select id="month" aria-label={picker["aria-label"]} onChange={(e) => picker.onChange(e.currentTarget.value)}>
                  {/* Destructure: an item's `date` (a CalendarDate object) is not serializable. */}
                  {picker.items().map(({ id, formatted }) => (
                    <option value={String(id)} selected={id === picker.value()}>
                      {formatted}
                    </option>
                  ))}
                </select>
              )}
            </CalendarMonthPicker>
            <CalendarYearPicker visibleYears={10}>
              {(picker: CalendarPickerAria) => (
                <select id="year" aria-label={picker["aria-label"]} onChange={(e) => picker.onChange(e.currentTarget.value)}>
                  {picker.items().map(({ id, formatted }) => (
                    <option value={String(id)} selected={id === picker.value()}>
                      {formatted}
                    </option>
                  ))}
                </select>
              )}
            </CalendarYearPicker>
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
