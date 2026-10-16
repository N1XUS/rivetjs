import type { CalendarDate } from "@rivetjs/cdk/date";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "./Icon.tsx";

/** The field part of a DateRangePicker: start and end DateInputs and the calendar button in a Group. */
export function RangeFields() {
  return (
    <Group>
      <DateInput slot="start">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
      <span aria-hidden="true">–</span>
      <DateInput slot="end">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
      <Button>
        <Icon icon={ChevronDown} />
      </Button>
    </Group>
  );
}

/** The popover part: a dialog with a one-month RangeCalendar. */
export function RangePopover() {
  return (
    <Popover>
      <Dialog>
        <RangeCalendar>
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <CalendarGrid>{(date: CalendarDate) => <CalendarCell date={date} />}</CalendarGrid>
        </RangeCalendar>
      </Dialog>
    </Popover>
  );
}
