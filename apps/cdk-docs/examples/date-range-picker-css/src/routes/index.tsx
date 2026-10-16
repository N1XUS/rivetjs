import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: plain CSS" };

// #region demo
export default function Plain() {
  return (
    <I18nProvider locale="en-US">
      <main>
        <DateRangePicker id="css" defaultValue={{ start: "2026-10-14", end: "2026-10-18" }}>
          <Label>Stay</Label>
          <RangeFields />
          <Text slot="description">Check-in to check-out.</Text>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker id="css-bad" defaultValue={{ start: "2026-10-18", end: "2026-10-14" }} validationBehavior="aria">
          <Label>Reversed</Label>
          <RangeFields />
          <FieldError />
          <RangePopover />
        </DateRangePicker>
      </main>
    </I18nProvider>
  );
}
// #endregion
