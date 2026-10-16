import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: disabled and read-only" };

// #region demo
export default function States() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        {/* isDisabled: segments leave the tab order, the hidden input is disabled (not submitted). */}
        <DateField id="off" name="off" defaultValue="2026-10-14" isDisabled>
          <Label>Disabled</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        {/* isReadOnly: focusable and announced, but the value cannot change; it is still submitted. */}
        <DateField id="ro" name="ro" defaultValue="2026-10-14" isReadOnly>
          <Label>Read-only</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
      </section>
    </I18nProvider>
  );
}
// #endregion
