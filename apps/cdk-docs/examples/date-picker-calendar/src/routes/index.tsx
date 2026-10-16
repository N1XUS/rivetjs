import { signal } from "@rivetjs/reactivity";
import { isWeekend, type DateValue } from "@rivetjs/cdk/date";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Label } from "@rivetjs/cdk/label";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker: calendar options" };

/** The parts below the label: the group (field + calendar button) and the popover with the calendar. */
function PickerBody() {
  return (
    <>
      <Group>
        <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        <Button>
          <Icon icon={ChevronDown} />
        </Button>
      </Group>
      <Popover>
        <Dialog>
          <Calendar>
            <header>
              <Button slot="previous">
                <Icon icon={ChevronLeft} />
              </Button>
              <Heading />
              <Button slot="next">
                <Icon icon={ChevronRight} />
              </Button>
            </header>
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </>
  );
}

// #region demo
export default function Options() {
  const date = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DatePicker
          id="opts"
          value={date}
          // The calendar's options: the week starts on Monday; the page buttons move one month (one unit).
          firstDayOfWeek="mon"
          pageBehavior="single"
          // Bounds and unavailable days: disabled in the calendar, invalid when typed.
          minValue="2026-10-05"
          maxValue="2026-11-30"
          isDateUnavailable={(day: DateValue) => isWeekend(day, "en-US")}
          // Keep the calendar open after a pick; closing it commits.
          shouldCloseOnSelect={false}
        >
          <Label>Delivery</Label>
          <PickerBody />
        </DatePicker>
        <p id="value" class="text-slate-600">
          Value: {date() ?? "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
