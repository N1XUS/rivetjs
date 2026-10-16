import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { RangeCalendar, CalendarCell, CalendarGrid, CalendarMonthPicker, CalendarYearPicker } from "@rivetjs/cdk/range-calendar";
import type { CalendarPickerAria } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: month and year pickers" };

/** A native select over a picker's { "aria-label", value(), onChange, items() }. */
function PickerSelect(props: { picker: CalendarPickerAria; id: string }) {
  const { picker, id } = props;
  return (
    <select id={id} class="picker" aria-label={picker["aria-label"]} onChange={(e: Event) => picker.onChange((e.currentTarget as HTMLSelectElement).value)}>
      {/* Items carry a CalendarDate (not serializable): bind plain fields only. */}
      {picker.items().map(({ id: key, formatted }) => (
        <option value={String(key)} selected={key === picker.value()}>
          {formatted}
        </option>
      ))}
    </select>
  );
}

// #region demo
export default function Pickers() {
  const range = signal<{ start: string; end: string } | null>({ start: "2026-10-12", end: "2026-10-16" });
  return (
    <I18nProvider locale="en-US">
      <main>
        <RangeCalendar id="range" aria-label="Project" value={range}>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            {/* The pickers move the focused date (and the visible month); the selected range stays. */}
            <CalendarMonthPicker>{(picker: CalendarPickerAria) => <PickerSelect id="month" picker={picker} />}</CalendarMonthPicker>
            <CalendarYearPicker>{(picker: CalendarPickerAria) => <PickerSelect id="year" picker={picker} />}</CalendarYearPicker>
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
        </RangeCalendar>
        <output id="value">{range() ? range()!.start + " → " + range()!.end : "none"}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
