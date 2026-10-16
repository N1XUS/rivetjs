import { signal } from "@rivetjs/reactivity";
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

export const head = { title: "DatePicker: date and time" };

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
export default function Meeting() {
  const meeting = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Time segments: a day picked in the calendar keeps the current time, else the placeholder's (09:00). */}
        <DatePicker id="meet" granularity="minute" value={meeting} placeholderValue="2026-10-14T09:00">
          <Label>Meeting</Label>
          <PickerBody />
        </DatePicker>
        <p id="value" class="text-slate-600">
          Value: {meeting() ?? "none"}
        </p>
        <DatePicker id="h24" granularity="second" hourCycle={24} defaultValue="2026-10-14T21:05:09">
          <Label>24-hour, seconds</Label>
          <PickerBody />
        </DatePicker>
        {/* A zoned value shows its time zone; hideTimeZone hides it. */}
        <DatePicker id="zoned" defaultValue="2026-10-14T09:30[Europe/Paris]">
          <Label>Flight (Paris time)</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="zoned-hidden" defaultValue="2026-10-14T09:30[Europe/Paris]" hideTimeZone>
          <Label>Flight, zone hidden</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="zeros" defaultValue="2026-03-04" shouldForceLeadingZeros>
          <Label>Leading zeros</Label>
          <PickerBody />
        </DatePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
