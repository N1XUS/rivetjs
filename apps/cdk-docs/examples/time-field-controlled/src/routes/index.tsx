import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "TimeField: controlled and uncontrolled" };

// #region demo
export default function Alarm() {
  // Controlled: the signal holds the ISO time string; writing it updates the segments.
  const alarm = signal<string | null>("07:15");
  const last = signal("none");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <TimeField id="alarm" value={alarm} onChange={(time) => last.set(time ? time.toString() : "null")}>
          <Label>Alarm (controlled)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <div class="flex gap-2">
          <button id="noon" type="button" class="rounded border px-2 py-1" onClick={() => alarm.set("12:00")}>
            Noon
          </button>
          <button id="clear" type="button" class="rounded border px-2 py-1" onClick={() => alarm.set(null)}>
            Clear
          </button>
        </div>
        {/* Uncontrolled: defaultValue (a string or a Time object) seeds the field's own value. */}
        <TimeField id="lunch" defaultValue="12:30">
          <Label>Lunch (uncontrolled)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <p id="value" class="text-slate-600">
          Signal: {alarm() ?? "null"} · last onChange: {last()}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
