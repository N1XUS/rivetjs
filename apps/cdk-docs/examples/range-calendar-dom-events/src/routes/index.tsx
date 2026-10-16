import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const range = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Every part takes global DOM events and attributes; the parts' own handlers run first. */}
        <RangeCalendar id="range" aria-label="Range" value={range} defaultFocusedValue="2026-10-14" dir="ltr" onDblClick={() => add("root-dbl")}>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading lang="en" />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid translate="no" onClick={() => add("grid-click")}>
            {(day: CalendarDate) => (
              <CalendarCell
                date={day}
                onPointerUp={(e: PointerEvent) => add("cell-up:" + (e.currentTarget as HTMLElement).dataset.date)}
                onDblClick={(e: MouseEvent) => add("cell-dbl:" + (e.currentTarget as HTMLElement).dataset.date)}
              />
            )}
          </CalendarGrid>
        </RangeCalendar>
        <output id="value">{range() ? range()!.start + ".." + range()!.end : "none"}</output>
        <output id="log">{log().join(" ")}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
