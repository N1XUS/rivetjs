import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "TimeField" };

// #region demo
export default function MeetingTime() {
  // The value is the time's ISO string ("09:30:00"), or null.
  const time = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <TimeField id="start" value={time}>
          <Label>Event time</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <Text slot="description">Type digits, A / P, or use the arrow keys.</Text>
          <FieldError />
        </TimeField>
        <p id="value" class="text-slate-600">
          Value: {time() ?? "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
