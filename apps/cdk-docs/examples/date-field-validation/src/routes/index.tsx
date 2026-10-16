import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";
import { isWeekend, type DateValue } from "@rivetjs/cdk/date";

export const head = { title: "DateField: validation" };

// #region demo
export default function Booking() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* validationBehavior="aria": errors show as soon as the value is invalid (server-rendered too); nothing blocks a submit. */}
        <DateField id="checkin" defaultValue="2026-10-17" isDateUnavailable={(date: DateValue) => isWeekend(date, "en-US")} validationBehavior="aria">
          <Label>Check-in (weekdays)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </DateField>
        <DateField id="checkout" defaultValue="2026-11-02" minValue="2026-10-01" maxValue="2026-10-31" validationBehavior="aria">
          <Label>Check-out (October)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </DateField>
        {/* validate: gets the date object (or null); return a message (or messages) when invalid, null / true when valid. */}
        <DateField
          id="party"
          defaultValue="2026-11-13"
          validate={(value: DateValue | null) => (value && value.day === 13 ? "Pick any day but the 13th." : null)}
          validationBehavior="aria"
        >
          <Label>Party (not on the 13th)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError />
        </DateField>
        {/* FieldError children: content, or a function of the validation result (accessors). */}
        <DateField id="return" defaultValue="2026-09-30" minValue="2026-10-01" validationBehavior="aria">
          <Label>Return</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError>{({ validationDetails }) => (validationDetails().rangeUnderflow ? "Too early: October at the earliest." : "Invalid")}</FieldError>
        </DateField>
        {/* isInvalid: the invalid state comes from you (a boolean or an accessor); FieldError shows your text. */}
        <DateField id="flagged" defaultValue="2026-10-14" isInvalid>
          <Label>Flagged</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <FieldError>Flagged by the server.</FieldError>
        </DateField>
      </section>
    </I18nProvider>
  );
}
// #endregion
