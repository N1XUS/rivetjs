import { signal } from "@rivetjs/reactivity";
import { DateFormatter, type CalendarDate, type DateValue } from "@rivetjs/cdk/date";
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

export const head = { title: "DatePicker: controlled" };

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
export default function Controlled() {
  // The value (ISO string) and the popover's open state are two-way signals.
  const date = signal<string | null>("2026-10-14");
  const open = signal(false);
  // onChange gets the date object (a CalendarDate here), not the string.
  const picked = signal("--");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <div class="flex flex-wrap gap-2">
          <button id="today" type="button" class="rounded border px-2 py-1" onClick={() => date.set("2026-10-05")}>
            Oct 5
          </button>
          <button id="clear" type="button" class="rounded border px-2 py-1" onClick={() => date.set(null)}>
            Clear
          </button>
          <button id="open" type="button" class="rounded border px-2 py-1" onClick={() => open.set(true)}>
            Open calendar
          </button>
        </div>
        <DatePicker
          id="due"
          value={date}
          isOpen={open}
          placeholderValue="2026-10-14"
          onChange={(value: DateValue | null) =>
            picked.set(value ? new DateFormatter("en-US", { dateStyle: "full", timeZone: "UTC" }).format(value.toDate("UTC")) : "--")
          }
        >
          <Label>Due</Label>
          <PickerBody />
        </DatePicker>
        <p id="value" class="text-slate-600">
          Value: {date() ?? "none"} · open: {String(open())}
        </p>
        <p id="picked" class="text-slate-600">
          Picked: {picked()}
        </p>
        {/* Uncontrolled: defaultValue seeds the picker's own value; defaultOpen opens the popover on load. */}
        <DatePicker id="start" defaultValue="2026-10-01">
          <Label>Start (uncontrolled)</Label>
          <PickerBody />
        </DatePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
