import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: controlled" };

// #region demo
export default function Controlled() {
  const range = signal<{ start: string; end: string } | null>({ start: "2026-10-12", end: "2026-10-16" });
  const open = signal(false);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <div class="flex flex-wrap gap-2">
          <button id="next-week" type="button" class="rounded border px-2 py-1" onClick={() => range.set({ start: "2026-10-19", end: "2026-10-23" })}>
            Next week
          </button>
          <button id="clear" type="button" class="rounded border px-2 py-1" onClick={() => range.set(null)}>
            Clear
          </button>
          <button id="open" type="button" class="rounded border px-2 py-1" onClick={() => open.set(true)}>
            Open calendar
          </button>
        </div>
        {/* value and isOpen: two-way signals. */}
        <DateRangePicker id="sprint" value={range} isOpen={open} placeholderValue="2026-10-14">
          <Label>Sprint</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        <p id="value" class="text-slate-600">
          Value: {range() ? range()!.start + " → " + range()!.end : "null"} · open: {String(open())}
        </p>
        {/* Uncontrolled: defaultValue seeds the picker's own value. */}
        <DateRangePicker id="trip" defaultValue={{ start: "2026-12-20", end: "2027-01-03" }}>
          <Label>Trip (uncontrolled)</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
