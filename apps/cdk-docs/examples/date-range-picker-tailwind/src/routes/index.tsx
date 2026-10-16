import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DateRangePicker: Tailwind" };

// `class` replaces the rv-* default; state via data-* variants (group-data-[open]: from the root) or render-prop functions.
const segment = "rounded px-0.5 tabular-nums outline-none focus:bg-teal-600 focus:text-white data-[placeholder]:text-slate-400 data-[type=literal]:px-0";
const pageButton = "grid size-7 place-items-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30";

// #region demo
export default function Styled() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md gap-4 text-sm">
        <DateRangePicker id="tw" defaultValue={{ start: "2026-10-14", end: "2026-10-18" }} class="group grid gap-1">
          <Label class="font-medium text-slate-700">Stay</Label>
          <Group class="inline-flex w-fit items-center gap-1 rounded-md border border-slate-300 bg-white py-1 pl-2 pr-1 shadow-sm data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-600/40 group-data-[open]:border-teal-600">
            <DateInput slot="start" class="inline-flex">
              {(s: DateSegmentItem) => <DateSegment segment={s} class={segment} />}
            </DateInput>
            <span aria-hidden="true" class="text-slate-400">
              –
            </span>
            <DateInput slot="end" class="inline-flex">
              {(s: DateSegmentItem) => <DateSegment segment={s} class={segment} />}
            </DateInput>
            <Button class={({ isPressed }) => "grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100 " + (isPressed() ? "bg-teal-50" : "")}>
              <Icon icon={CalendarDays} size={14} />
            </Button>
          </Group>
          <Text slot="description" class="text-xs text-slate-500">
            Check-in to check-out.
          </Text>
          <Popover class="rounded-lg border border-slate-200 bg-white p-3 shadow-lg transition data-[entering]:opacity-0 data-[exiting]:opacity-0">
            <Dialog class="outline-none">
              <RangeCalendar>
                <header class="mb-2 flex items-center justify-between">
                  <Button slot="previous" class={pageButton}>
                    <Icon icon={ChevronLeft} />
                  </Button>
                  <Heading class="m-0 text-sm font-semibold" />
                  <Button slot="next" class={pageButton}>
                    <Icon icon={ChevronRight} />
                  </Button>
                </header>
                <CalendarGrid class="border-collapse [&_th]:pb-1 [&_th]:text-xs [&_th]:font-medium [&_th]:text-slate-500">
                  {(date: CalendarDate) => (
                    <CalendarCell
                      date={date}
                      // A render-prop function: the states are accessors.
                      class={({ isSelected, isSelectionStart, isSelectionEnd, isOutsideMonth, isFocusVisible }) =>
                        "grid size-8 cursor-pointer place-items-center outline-none " +
                        (isOutsideMonth() ? "invisible " : "") +
                        (isSelectionStart() || isSelectionEnd()
                          ? "bg-teal-600 text-white "
                          : isSelected()
                            ? "bg-teal-100 text-teal-900 "
                            : "hover:bg-slate-100 ") +
                        (isSelectionStart() ? "rounded-l-full " : "") +
                        (isSelectionEnd() ? "rounded-r-full " : "") +
                        (isFocusVisible() ? "ring-2 ring-teal-700 ring-inset" : "")
                      }
                    />
                  )}
                </CalendarGrid>
              </RangeCalendar>
            </Dialog>
          </Popover>
        </DateRangePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
