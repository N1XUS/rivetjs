import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Root <div role="application">. */}
        <Calendar
          id="cal"
          aria-label="Dates"
          defaultFocusedValue="2026-10-14"
          lang="en"
          dir="ltr"
          onPointerEnter={() => add("root-enter")}
          onDblClick={() => add("root-dbl")}
        >
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            {/* Heading <h2>. */}
            <Heading lang="en" onDblClick={() => add("heading-dbl")} />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          {/* The month <table role="grid">: the grid's own handlers run first. */}
          <CalendarGrid translate="no" onPointerDown={(e: PointerEvent) => add("grid-down:" + e.button)} onContextMenu={() => add("grid-menu")}>
            {/* Every day cell <div role="button">; dataset.date names the day. */}
            {(day: CalendarDate) => (
              <CalendarCell date={day} lang="en" onPointerEnter={(e: PointerEvent) => add("cell-enter:" + (e.currentTarget as HTMLElement).dataset.date)} />
            )}
          </CalendarGrid>
        </Calendar>
        <output id="log">{log().join(" ")}</output>
      </main>
    </I18nProvider>
  );
}
// #endregion
