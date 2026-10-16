import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DateField
          id="when"
          defaultValue="2026-10-14"
          onChange={(date) => add("change:" + String(date))}
          onFocus={() => add("focus")}
          onBlur={() => add("blur")}
          onFocusChange={(isFocused) => add("focusChange:" + isFocused)}
          onKeyDown={(event) => add("keydown:" + event.key)}
          onKeyUp={(event) => add("keyup:" + event.key)}
        >
          <Label>When</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <button id="outside" type="button" class="rounded border px-2 py-1">
          Outside
        </button>
        {/* Last: a growing log must not move the field under the pointer. */}
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
