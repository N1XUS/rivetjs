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
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker" };

// #region demo
export default function Booking() {
  const date = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <DatePicker id="trip" value={date} placeholderValue="2026-10-14">
          <Label>Departure</Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>
              <Icon icon={ChevronDown} />
            </Button>
          </Group>
          <Text slot="description">Type a date or pick one.</Text>
          <FieldError />
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
        </DatePicker>
        <p id="value" class="text-slate-600">
          Value: {date() ?? "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
