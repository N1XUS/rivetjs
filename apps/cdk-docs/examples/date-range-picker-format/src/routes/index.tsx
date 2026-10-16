import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: locales and calendars" };

// #region demo
export default function Locales() {
  const range = signal<{ start: string; end: string } | null>({ start: "2026-10-14", end: "2026-10-18" });
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* The enclosing I18nProvider sets the segment order, the placeholders and the calendar's week. */}
      <I18nProvider locale="de-DE">
        <DateRangePicker id="de" defaultValue={{ start: "2026-10-14", end: "2026-10-18" }}>
          <Label>Aufenthalt</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
      </I18nProvider>
      {/* A calendar extension displays another calendar system; the value stays Gregorian. */}
      <I18nProvider locale="ja-JP-u-ca-japanese">
        <DateRangePicker id="ja" value={range}>
          <Label>滞在</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
      </I18nProvider>
      <p id="value" class="text-slate-600">
        Value: {range() ? range()!.start + " → " + range()!.end : "none"}
      </p>
    </section>
  );
}
// #endregion
