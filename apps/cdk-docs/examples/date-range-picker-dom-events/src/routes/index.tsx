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
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DateRangePicker: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Each part takes global DOM attributes and events on its own element. */}
        <DateRangePicker id="dom" defaultValue={{ start: "2026-10-14", end: "2026-10-16" }} dir="ltr" onPointerEnter={() => add("root-enter")}>
          <Label>Range</Label>
          <Group lang="en" onPointerDown={() => add("group-down")}>
            <DateInput slot="start" onPointerUp={(event) => add("input-up:" + event.currentTarget.id)}>
              {(segment: DateSegmentItem) => <DateSegment segment={segment} translate="no" />}
            </DateInput>
            <span aria-hidden="true">–</span>
            <DateInput slot="end" onPointerUp={(event) => add("input-up:" + event.currentTarget.id)}>
              {(segment: DateSegmentItem) => <DateSegment segment={segment} translate="no" />}
            </DateInput>
            <Button onClick={() => add("button-click")} data-testid="toggle">
              <Icon icon={ChevronDown} />
            </Button>
          </Group>
          <Popover lang="en">
            <Dialog lang="en">
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
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
