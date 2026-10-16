import { signal } from "@rivetjs/reactivity";
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
import { FieldError } from "@rivetjs/cdk/form";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DateRangePicker" };

// #region demo
export default function Stay() {
  // The value is { start, end } ISO strings, or null until both ends are set.
  const stay = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DateRangePicker id="stay" value={stay} placeholderValue="2026-10-14">
          <Label>Stay</Label>
          <Group>
            <DateInput slot="start">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <span aria-hidden="true">–</span>
            <DateInput slot="end">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>
              <Icon icon={ChevronDown} />
            </Button>
          </Group>
          <Text slot="description">Check-in to check-out.</Text>
          <FieldError />
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
        </DateRangePicker>
        <p id="value" class="text-slate-600">
          Value: {stay() ? stay()!.start + " → " + stay()!.end : "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
