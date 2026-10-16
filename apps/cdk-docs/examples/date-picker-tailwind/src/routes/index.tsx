import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker: Tailwind" };

const pageButton =
  "grid size-7 place-items-center rounded-full text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600";

// #region demo
export default function Styled() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm gap-4 text-sm">
        {/* class: a string, or a function of the render props (accessors). */}
        <DatePicker
          id="tw"
          defaultValue="2026-10-14"
          maxValue="2026-12-31"
          class={({ isInvalid }) => "group grid gap-1" + (isInvalid() ? " text-red-700" : "")}
        >
          <Label class="font-medium text-slate-700">Check-in</Label>
          <Group class="inline-flex w-fit items-center gap-1 rounded-md border border-slate-300 bg-white py-1 pl-2 pr-1 shadow-sm focus-within:border-teal-600 group-data-[open]:border-teal-600 group-data-[open]:ring-2 group-data-[open]:ring-teal-600/30 group-data-[invalid]:border-red-600">
            <DateInput class="inline-flex">
              {(segment: DateSegmentItem) => (
                <DateSegment
                  segment={segment}
                  class={({ isPlaceholder, type }) =>
                    "rounded px-0.5 tabular-nums outline-none focus:bg-teal-600 focus:text-white" +
                    (isPlaceholder() ? " text-slate-400" : "") +
                    (type === "literal" ? " px-0" : "")
                  }
                />
              )}
            </DateInput>
            <Button class="grid place-items-center rounded px-1.5 py-0.5 text-slate-500 outline-none hover:bg-slate-100 aria-expanded:bg-teal-50 aria-expanded:text-teal-700">
              <Icon icon={CalendarDays} />
            </Button>
          </Group>
          <Text slot="description" class="text-xs text-slate-500">
            Until the end of the year.
          </Text>
          <FieldError class="text-xs text-red-700" />
          {/* entering: / exiting: (data-entering / data-exiting) and placement-*: come from @rivetjs/cdk/tailwind.css. */}
          <Popover class="rounded-lg border border-slate-200 bg-white p-3 shadow-lg outline-none entering:animate-pop-in exiting:animate-pop-out placement-bottom:mt-1">
            <Dialog class="outline-none">
              <Calendar class="grid gap-2">
                <header class="flex items-center">
                  <Button slot="previous" class={pageButton}>
                    <Icon icon={ChevronLeft} />
                  </Button>
                  <Heading class="m-0 flex-1 text-center text-sm font-semibold" />
                  <Button slot="next" class={pageButton}>
                    <Icon icon={ChevronRight} />
                  </Button>
                </header>
                <CalendarGrid class="border-collapse">
                  <CalendarGridHeader>
                    {(day: string) => <CalendarHeaderCell class="pb-1 text-xs font-medium text-slate-500">{day}</CalendarHeaderCell>}
                  </CalendarGridHeader>
                  <CalendarGridBody>
                    {(day: CalendarDate) => (
                      <CalendarCell
                        date={day}
                        class={({ isSelected, isDisabled }) =>
                          "grid size-8 cursor-default place-items-center rounded-full outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-600 data-[outside-month]:invisible " +
                          (isSelected() ? "bg-teal-600 text-white" : isDisabled() ? "text-slate-300" : "hover:bg-slate-100")
                        }
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </Calendar>
            </Dialog>
          </Popover>
        </DatePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
