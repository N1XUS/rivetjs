import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem, type TimeValue } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "TimeField: validation" };

// #region demo
export default function OpeningHours() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* minValue / maxValue: built-in range validation. validationBehavior="aria" shows errors at once. */}
        <TimeField id="visit" defaultValue="18:30" minValue="09:00" maxValue="17:00" validationBehavior="aria">
          <Label>Visit (9 AM to 5 PM)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </TimeField>
        {/* validate: gets the Time (or null); return a message when invalid. */}
        <TimeField
          id="slot"
          defaultValue="10:20"
          validate={(time: TimeValue | null) => (time && time.minute % 15 !== 0 ? "Appointments start every 15 minutes." : null)}
          validationBehavior="aria"
        >
          <Label>Appointment</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </TimeField>
        {/* isInvalid: the state comes from you; FieldError shows your text. */}
        <TimeField id="flagged" defaultValue="12:00" isInvalid>
          <Label>Flagged</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError>Already booked.</FieldError>
        </TimeField>
      </section>
    </I18nProvider>
  );
}
// #endregion
