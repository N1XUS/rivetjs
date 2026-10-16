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
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DateRangePicker: popover calendar" };

// #region demo
export default function TwoMonths() {
  const trip = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-xl justify-items-start gap-3 text-sm">
        <DateRangePicker id="trip" value={trip} placeholderValue="2026-10-14">
          <Label>Trip</Label>
          <Group>
            <DateInput slot="start">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <span aria-hidden="true">–</span>
            <DateInput slot="end">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>
              <Icon icon={CalendarDays} />
            </Button>
          </Group>
          <Popover>
            <Dialog>
              {/* Two months: visibleDuration on the calendar, one grid per month (offset). Paging moves both. */}
              <RangeCalendar visibleDuration={{ months: 2 }}>
                <header>
                  <Button slot="previous">
                    <Icon icon={ChevronLeft} />
                  </Button>
                  <Heading />
                  <Button slot="next">
                    <Icon icon={ChevronRight} />
                  </Button>
                </header>
                <div class="months">
                  <CalendarGrid weekdayStyle="short">{(date: CalendarDate) => <CalendarCell date={date} />}</CalendarGrid>
                  <CalendarGrid weekdayStyle="short" offset={{ months: 1 }}>
                    {(date: CalendarDate) => <CalendarCell date={date} />}
                  </CalendarGrid>
                </div>
              </RangeCalendar>
            </Dialog>
          </Popover>
        </DateRangePicker>
        <p id="value" class="text-slate-600">
          Value: {trip() ? trip()!.start + " → " + trip()!.end : "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
