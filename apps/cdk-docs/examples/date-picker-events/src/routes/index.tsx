import { signal } from "@rivetjs/reactivity";
import type { CalendarDate, DateValue } from "@rivetjs/cdk/date";
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

export const head = { title: "DatePicker: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DatePicker
          id="ev"
          defaultValue="2026-10-14"
          onChange={(date: DateValue | null) => add("change:" + String(date))}
          onOpenChange={(isOpen: boolean) => add("open:" + isOpen)}
          onFocus={() => add("focus")}
          onBlur={() => add("blur")}
          onFocusChange={(isFocused: boolean) => add("focusChange:" + isFocused)}
          onKeyDown={(event: KeyboardEvent) => add("keydown:" + event.key)}
          onKeyUp={(event: KeyboardEvent) => add("keyup:" + event.key)}
        >
          <Label>When</Label>
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
        </DatePicker>
        <button id="outside" type="button" class="rounded border px-2 py-1">
          Outside
        </button>
        {/* Last: a growing log must not move the picker under the pointer. */}
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
