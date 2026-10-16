import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import { Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, CalendarHeading } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: Tailwind" };

// #region demo
export default function Tailwind() {
  const date = signal<string | null>("2026-10-14");
  const sundays = (d: CalendarDate) => d.toDate("UTC").getUTCDay() === 0;
  const button =
    "grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30";
  return (
    <I18nProvider locale="en-US">
      <main class="flex flex-wrap items-start gap-4 p-4">
        {/* class is a string or a function of the render props (accessors). */}
        <Calendar
          id="cal"
          aria-label="Appointment"
          value={date}
          isDateUnavailable={sundays}
          class={({ isInvalid }) => "inline-flex flex-col gap-2 rounded-xl border p-3 shadow-sm " + (isInvalid() ? "border-red-500" : "border-slate-200")}
        >
          <header class="flex items-center">
            <Button slot="previous" class={button}>
              <Icon icon={ChevronLeft} size={18} />
            </Button>
            <CalendarHeading class="mx-2 my-0 flex-1 text-center text-base font-semibold" />
            <Button slot="next" class={button}>
              <Icon icon={ChevronRight} size={18} />
            </Button>
          </header>
          <CalendarGrid class="border-spacing-0">
            <CalendarGridHeader>
              {(day: string) => <CalendarHeaderCell class="pb-1 text-xs font-semibold text-slate-500">{day}</CalendarHeaderCell>}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(day: CalendarDate) => (
                <CalendarCell
                  date={day}
                  class={({ isSelected, isDisabled, isUnavailable }) =>
                    "flex size-9 cursor-default items-center justify-center rounded-full text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500 data-[outside-month]:invisible " +
                    (isSelected()
                      ? "bg-indigo-600 text-white data-[invalid]:bg-red-600"
                      : isDisabled() || isUnavailable()
                        ? "text-slate-300"
                        : "text-slate-900 hover:bg-slate-100 data-[pressed]:bg-slate-200")
                  }
                />
              )}
            </CalendarGridBody>
          </CalendarGrid>
          <Text slot="errorMessage" class="hidden text-sm text-red-600 [[data-invalid]_&]:block">
            Sundays are closed.
          </Text>
        </Calendar>
        <output id="value" class="text-sm text-slate-600">
          {date() ?? "none"}
        </output>
      </main>
    </I18nProvider>
  );
}
// #endregion
