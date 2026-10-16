import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DateRangePicker
          id="ev"
          defaultValue={{ start: "2026-10-14", end: "2026-10-16" }}
          // onChange gets { start, end } date objects, or null.
          onChange={(range) => add("change:" + (range ? range.start + ".." + range.end : "null"))}
          onOpenChange={(isOpen) => add("open:" + isOpen)}
          onFocus={() => add("focus")}
          onBlur={() => add("blur")}
          onFocusChange={(isFocused) => add("focusChange:" + isFocused)}
          onKeyDown={(event) => add("keydown:" + event.key)}
          onKeyUp={(event) => add("keyup:" + event.key)}
        >
          <Label>Stay</Label>
          <RangeFields />
          <RangePopover />
        </DateRangePicker>
        <button id="outside" type="button" class="rounded border px-2 py-1">
          Outside
        </button>
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
