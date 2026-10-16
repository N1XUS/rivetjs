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

export const head = { title: "DatePicker: disabled and read-only" };

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
export default function States() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <DatePicker id="off" defaultValue="2026-10-14" isDisabled>
          <Label>Disabled</Label>
          <PickerBody />
        </DatePicker>
        {/* Read-only: segments focusable, value fixed, the calendar button disabled. */}
        <DatePicker id="ro" defaultValue="2026-10-14" isReadOnly>
          <Label>Read-only</Label>
          <PickerBody />
        </DatePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
