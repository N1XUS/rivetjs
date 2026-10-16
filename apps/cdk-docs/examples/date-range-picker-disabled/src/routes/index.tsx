import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: disabled and read-only" };

// #region demo
export default function States() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Disabled: segments not focusable, the button disabled, nothing submitted. */}
        <DateRangePicker id="off" isDisabled defaultValue={{ start: "2026-10-14", end: "2026-10-18" }}>
          <Label>Disabled</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        {/* Read-only: segments focusable, the value fixed, the button disabled; still submitted. */}
        <DateRangePicker id="fixed" isReadOnly defaultValue={{ start: "2026-10-14", end: "2026-10-18" }}>
          <Label>Read-only</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
