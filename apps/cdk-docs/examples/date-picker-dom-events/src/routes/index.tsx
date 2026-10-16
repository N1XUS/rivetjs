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
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        <DatePicker
          id="dom"
          defaultValue="2026-10-14"
          // Root element (div.rv-DatePicker): any global DOM event or attribute.
          lang="en"
          onPointerEnter={() => add("root-enter")}
          onDblClick={() => add("root-dbl")}
        >
          <Label>Picker</Label>
          {/* Each part takes its own DOM props; the part's behaviour runs first. */}
          <Group dir="ltr" onPointerUp={() => add("group-up")}>
            <DateInput translate="no">
              {(segment: DateSegmentItem) => <DateSegment segment={segment} onPointerEnter={() => add("segment-enter:" + segment.type)} />}
            </DateInput>
            <Button lang="en" onClick={() => add("button-click")}>
              <Icon icon={ChevronDown} />
            </Button>
          </Group>
          <Popover lang="en" onWheel={() => add("popover-wheel")}>
            <Dialog
              lang="en"
              onContextMenu={(event: MouseEvent) => {
                event.preventDefault();
                add("dialog-menu");
              }}
            >
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
        <output id="log" class="text-slate-600">
          {log().join(" ")}
        </output>
      </section>
    </I18nProvider>
  );
}
// #endregion
