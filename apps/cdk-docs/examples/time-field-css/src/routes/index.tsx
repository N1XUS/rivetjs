import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "TimeField: plain CSS" };

// #region demo
export default function Plain() {
  return (
    <I18nProvider locale="en-US">
      <section style={{ margin: "1rem", display: "grid", gap: "1rem", maxWidth: "24rem" }}>
        <TimeField id="css" placeholderValue="08:00">
          <Label>Wake up</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <TimeField id="css-bad" defaultValue="23:30" maxValue="22:00" validationBehavior="aria">
          <Label>Too late</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </TimeField>
        <TimeField id="css-off" defaultValue="12:00" isDisabled>
          <Label>Disabled</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
      </section>
    </I18nProvider>
  );
}
// #endregion
