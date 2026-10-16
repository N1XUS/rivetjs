import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { RangeCalendar, CalendarCell, CalendarGrid, CalendarHeading } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: Tailwind" };

// #region demo
export default function Tailwind() {
  const range = signal<{ start: string; end: string } | null>({ start: "2026-10-12", end: "2026-10-16" });
  const nav = "grid size-8 place-items-center rounded-full hover:bg-slate-100 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-sky-600";
  return (
    <I18nProvider locale="en-US">
      <main class="p-4">
        <RangeCalendar
          id="range"
          aria-label="Sprint"
          value={range}
          visibleDuration={{ months: 2 }}
          class="inline-block rounded-2xl border border-slate-200 p-4 shadow-sm"
        >
          <div class="flex gap-6">
            {[0, 1].map((offset) => (
              <div class="month">
                <header class="mb-2 flex items-center">
                  {offset === 0 ? (
                    <Button slot="previous" class={nav}>
                      <Icon icon={ChevronLeft} />
                    </Button>
                  ) : null}
                  <CalendarHeading offset={{ months: offset }} class="flex-1 text-center text-sm font-semibold" />
                  {offset === 1 ? (
                    <Button slot="next" class={nav}>
                      <Icon icon={ChevronRight} />
                    </Button>
                  ) : null}
                </header>
                <CalendarGrid offset={{ months: offset }} class="border-collapse text-sm">
                  {(day: CalendarDate) => (
                    <CalendarCell
                      date={day}
                      // Render props are accessors; the data-* variants of @rivetjs/cdk/tailwind.css work too.
                      class={({ isSelected, isSelectionStart, isSelectionEnd }) =>
                        "grid size-9 cursor-default place-items-center outline-none data-[outside-month]:invisible data-[disabled]:text-slate-300 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-600 " +
                        (isSelectionStart() || isSelectionEnd()
                          ? "bg-sky-600 text-white"
                          : isSelected()
                            ? "bg-sky-100 text-sky-900"
                            : "rounded-full hover:bg-slate-100") +
                        (isSelectionStart() ? " rounded-s-full" : "") +
                        (isSelectionEnd() ? " rounded-e-full" : "")
                      }
                    />
                  )}
                </CalendarGrid>
              </div>
            ))}
          </div>
        </RangeCalendar>
        <output id="value" class="mt-2 block text-sm text-slate-600">
          {range() ? range()!.start + " → " + range()!.end : "none"}
        </output>
      </main>
    </I18nProvider>
  );
}
// #endregion
