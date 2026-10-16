import { signal } from "@rivetjs/reactivity";
import { isWeekend, type CalendarDate, type DateValue } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: calendar options" };

// #region demo
export default function Options() {
  const workdays = signal<{ start: string; end: string } | null>(null);
  const leave = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Weekends unavailable: a range cannot span them (the days past the next unavailable one are disabled). */}
        <DateRangePicker
          id="work"
          value={workdays}
          placeholderValue="2026-10-14"
          isDateUnavailable={(day: DateValue) => isWeekend(day, "en-US")}
          firstDayOfWeek="mon"
        >
          <Label>Work block</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        {/* allowsNonContiguousRanges: a range may span unavailable days; shouldCloseOnSelect={false} keeps the popover open. */}
        <DateRangePicker
          id="leave"
          value={leave}
          placeholderValue="2026-10-14"
          isDateUnavailable={(day: DateValue) => isWeekend(day, "en-US")}
          allowsNonContiguousRanges
          shouldCloseOnSelect={false}
        >
          <Label>Leave (may span weekends)</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        {/* isDateUnavailable gets the anchor (first picked day) while a range is being picked: at most 7 nights. */}
        <DateRangePicker
          id="week"
          placeholderValue="2026-10-14"
          isDateUnavailable={(day: DateValue, anchor: CalendarDate | null) => anchor != null && Math.abs(day.compare(anchor)) > 7}
          minValue="2026-10-05"
          maxValue="2026-11-30"
        >
          <Label>Up to a week</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        <p id="value" class="text-slate-600">
          Work: {workdays() ? workdays()!.start + " → " + workdays()!.end : "none"} · Leave: {leave() ? leave()!.start + " → " + leave()!.end : "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
