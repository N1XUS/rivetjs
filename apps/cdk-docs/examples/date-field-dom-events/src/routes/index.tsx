import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DateField
          id="dom"
          defaultValue="2026-10-14"
          // Root element (div.rv-DateField): any global DOM event or attribute.
          lang="en"
          translate="no"
          onPointerEnter={() => add("root-enter")}
          onDblClick={() => add("root-dbl")}
          onContextMenu={(event) => {
            event.preventDefault();
            add("root-menu");
          }}
        >
          <Label>Field</Label>
          {/* The DateInput group of segments: its own pointer handlers run first. */}
          <DateInput dir="ltr" onPointerUp={() => add("input-up")}>
            {/* Every segment; the segment's type names it. */}
            {(segment: DateSegmentItem) => <DateSegment segment={segment} lang="en" onPointerEnter={() => add("segment-enter:" + segment.type)} />}
          </DateInput>
        </DateField>
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
