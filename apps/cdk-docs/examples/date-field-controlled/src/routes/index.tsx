import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: controlled and uncontrolled" };

// #region demo
export default function Deadlines() {
  // Controlled: the signal holds the ISO string; writing it updates the segments.
  const due = signal<string | null>("2026-10-14");
  const last = signal("none");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <DateField id="due" value={due} onChange={(date) => last.set(date ? date.toString() : "null")}>
          <Label>Due date (controlled)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <div class="flex gap-2">
          <button id="xmas" type="button" class="rounded border px-2 py-1" onClick={() => due.set("2026-12-25")}>
            Christmas
          </button>
          <button id="clear" type="button" class="rounded border px-2 py-1" onClick={() => due.set(null)}>
            Clear
          </button>
        </div>
        {/* Uncontrolled: defaultValue (a string or a date object) seeds the field's own value. */}
        <DateField id="start" defaultValue="2026-10-01">
          <Label>Start (uncontrolled)</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <p id="value" class="text-slate-600">
          Signal: {due() ?? "null"} · last onChange: {last()}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
