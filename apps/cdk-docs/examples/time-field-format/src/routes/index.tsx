import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "TimeField: format options" };

// #region demo
export default function Formats() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* granularity: the smallest unit shown ("minute" by default). */}
        <TimeField id="hour" granularity="hour" defaultValue="09:30">
          <Label>Hour</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <TimeField id="second" granularity="second" defaultValue="09:30:15">
          <Label>Second</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        {/* hourCycle: 12 or 24 hours, whatever the locale. */}
        <TimeField id="h24" hourCycle={24} defaultValue="21:05">
          <Label>24-hour</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        {/* The locale decides the default hour cycle, separators and segment names. */}
        <I18nProvider locale="de-DE">
          <TimeField id="de" defaultValue="21:05">
            <Label>Uhrzeit</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </TimeField>
        </I18nProvider>
        {/* shouldForceLeadingZeros: 09:05 instead of 9:05. */}
        <TimeField id="zeros" shouldForceLeadingZeros defaultValue="09:05">
          <Label>Leading zeros</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        {/* A zoned value shows the time zone; hideTimeZone hides it. */}
        <TimeField id="zoned" defaultValue="2026-10-14T17:45[America/Los_Angeles]">
          <Label>Zoned</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <TimeField id="zoned-hidden" hideTimeZone defaultValue="2026-10-14T17:45[America/Los_Angeles]">
          <Label>Zone hidden</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        {/* No value: placeholderValue is where spinning an empty segment starts. */}
        <TimeField id="empty" placeholderValue="08:00">
          <Label>Empty (placeholder 08:00)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
      </section>
    </I18nProvider>
  );
}
// #endregion
