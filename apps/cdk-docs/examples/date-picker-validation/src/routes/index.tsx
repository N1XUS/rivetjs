import { isWeekend, type DateValue } from "@rivetjs/cdk/date";
import { FieldError } from "@rivetjs/cdk/form";
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

export const head = { title: "DatePicker: validation" };

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
export default function Validation() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Built-in validation: dates outside minValue / maxValue or unavailable are invalid (Oct 17 is a Saturday). */}
        <DatePicker
          id="visit"
          defaultValue="2026-10-17"
          minValue="2026-10-01"
          maxValue="2026-10-31"
          isDateUnavailable={(day: DateValue) => isWeekend(day, "en-US")}
          validationBehavior="aria"
        >
          <Label>Visit (October weekdays)</Label>
          <PickerBody />
          <FieldError />
        </DatePicker>
        {/* validate: gets the date object; return a message when invalid. */}
        <DatePicker
          id="party"
          defaultValue="2026-11-13"
          validate={(value: DateValue | null) => (value && value.day === 13 ? "Pick any day but the 13th." : null)}
          validationBehavior="aria"
        >
          <Label>Party (not on the 13th)</Label>
          <PickerBody />
          <FieldError />
        </DatePicker>
        {/* FieldError children: content, or a function of the validation result (accessors). */}
        <DatePicker id="launch" defaultValue="2026-09-14" minValue="2026-10-01" validationBehavior="aria">
          <Label>Launch</Label>
          <PickerBody />
          <FieldError>{({ validationDetails }) => (validationDetails().rangeUnderflow ? "Launch in October at the earliest." : "Invalid date.")}</FieldError>
        </DatePicker>
        {/* isInvalid: the invalid state comes from you; FieldError shows your text. */}
        <DatePicker id="locked" defaultValue="2026-10-14" isInvalid>
          <Label>Locked</Label>
          <PickerBody />
          <FieldError>This date is locked.</FieldError>
        </DatePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
