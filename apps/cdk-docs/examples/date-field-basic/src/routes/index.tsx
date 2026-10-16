import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "DateField" };

// #region demo
export default function Appointment() {
  const date = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <DateField id="appt" value={date} placeholderValue="2026-10-14">
          <Label>Appointment</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <Text slot="description">Type digits or use the arrow keys.</Text>
          <FieldError />
        </DateField>
        <p id="value" class="text-slate-600">
          Value: {date() ?? "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
