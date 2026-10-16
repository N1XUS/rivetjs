import { signal } from "@rivetjs/reactivity";
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

export const head = { title: "DatePicker: forms" };

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
export default function Booking() {
  const submitted = signal("nothing yet");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md gap-3 text-sm">
        <form
          id="booking"
          class="grid justify-items-start gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            submitted.set([...data].map(([key, value]) => key + "=" + value).join("&"));
          }}
        >
          {/* name: a hidden input posts the ISO string. isRequired: native validation blocks an empty submit. */}
          <DatePicker id="appt" name="appointment" isRequired placeholderValue="2026-10-20">
            <Label>Appointment</Label>
            <PickerBody />
            <FieldError />
          </DatePicker>
          <DatePicker id="start" name="start" defaultValue="2026-10-14">
            <Label>Start</Label>
            <PickerBody />
          </DatePicker>
          <div class="flex gap-2">
            <button id="submit" type="submit" class="rounded border px-2 py-1">
              Submit
            </button>
            {/* A form reset restores every picker's defaultValue. */}
            <button id="reset" type="reset" class="rounded border px-2 py-1">
              Reset
            </button>
          </div>
        </form>
        {/* form: belong to a form elsewhere in the page, by its id. */}
        <DatePicker id="remote" name="remote" form="booking" defaultValue="2026-12-01">
          <Label>Outside the form</Label>
          <PickerBody />
        </DatePicker>
        <p id="value" class="text-slate-600">
          Submitted: {submitted()}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
