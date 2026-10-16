import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: date-time ranges" };

// #region demo
export default function Shifts() {
  const shift = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-lg justify-items-start gap-3 text-sm">
        {/* Time segments in both fields; picked days get the current times, else the placeholder's (09:00). */}
        <DateRangePicker id="shift" granularity="minute" hourCycle={24} value={shift} placeholderValue="2026-10-14T09:00">
          <Label>Shift</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        <p id="value" class="text-slate-600">
          Value: {shift() ? shift()!.start + " → " + shift()!.end : "none"}
        </p>
        {/* Zoned ends (each in its own time zone), zone segment hidden, leading zeros forced. */}
        <DateRangePicker
          id="flight"
          defaultValue={{ start: "2026-10-14T09:30[Europe/Paris]", end: "2026-10-14T13:45[America/New_York]" }}
          hideTimeZone
          shouldForceLeadingZeros
        >
          <Label>Flight (zoned, zone hidden)</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
