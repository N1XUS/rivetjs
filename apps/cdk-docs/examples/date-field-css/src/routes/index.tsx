import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "DateField: plain CSS" };

// #region demo
export default function Plain() {
  return (
    <I18nProvider locale="en-US">
      <section style={{ margin: "1rem", display: "grid", gap: "1rem", maxWidth: "24rem" }}>
        <DateField id="css" placeholderValue="2026-10-14">
          <Label>Arrival</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <Text slot="description">No class props: the rv-* defaults.</Text>
        </DateField>
        <DateField id="css-bad" defaultValue="2026-11-02" maxValue="2026-10-31" validationBehavior="aria">
          <Label>Too late</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </DateField>
        <DateField id="css-off" defaultValue="2026-10-14" isDisabled>
          <Label>Disabled</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
      </section>
    </I18nProvider>
  );
}
// #endregion
