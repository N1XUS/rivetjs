import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: granularity" };

// #region demo
export default function Granularity() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* A date-time string (CalendarDateTime) defaults to minute granularity. */}
        <DateField id="minute" defaultValue="2026-10-14T09:30">
          <Label>Minute (default for date-times)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <DateField id="hour" granularity="hour" defaultValue="2026-10-14T09:30">
          <Label>Hour</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <DateField id="second" granularity="second" hourCycle={24} defaultValue="2026-10-14T21:05:09">
          <Label>Second, 24-hour</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        {/* No value: placeholderValue sets the kind of value (here a date-time) and what ArrowUp starts from. */}
        <DateField id="empty" granularity="minute" placeholderValue="2026-10-14T08:00">
          <Label>Empty date-time</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        {/* maxGranularity: the largest unit shown. */}
        <DateField id="no-year" maxGranularity="month" defaultValue="2026-10-14">
          <Label>Month and day</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <DateField id="time-only" maxGranularity="hour" defaultValue="2026-10-14T09:30">
          <Label>Time of day</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
      </section>
    </I18nProvider>
  );
}
// #endregion
