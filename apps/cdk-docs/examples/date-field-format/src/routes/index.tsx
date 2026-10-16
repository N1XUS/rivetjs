import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: locale and format" };

// #region demo
export default function Formats() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* I18nProvider locale: segment order, separators, placeholders and the labels of the segments. */}
        <I18nProvider locale="de-DE">
          <DateField id="de" defaultValue="2026-10-14">
            <Label>Datum</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </DateField>
        </I18nProvider>
        <I18nProvider locale="en-GB">
          <DateField id="gb">
            <Label>Date (en-GB)</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </DateField>
        </I18nProvider>
        <DateField id="zeros" defaultValue="2026-03-04" shouldForceLeadingZeros>
          <Label>Leading zeros</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        {/* A zoned string (ZonedDateTime) shows the time zone; hideTimeZone hides it. */}
        <DateField id="zoned" defaultValue="2026-10-14T09:30[Europe/Paris]">
          <Label>Departure (Paris)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <DateField id="zoned-hidden" defaultValue="2026-10-14T09:30[Europe/Paris]" hideTimeZone>
          <Label>Departure, zone hidden</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        {/* The locale's calendar system displays the date (here the Japanese calendar, with an era); the value stays gregorian. */}
        <I18nProvider locale="ja-JP-u-ca-japanese">
          <DateField id="japanese" defaultValue="2026-10-14">
            <Label>和暦</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </DateField>
        </I18nProvider>
      </section>
    </I18nProvider>
  );
}
// #endregion
