import { signal } from "@rivetjs/reactivity";
import { Calendar, CalendarCell, CalendarGrid, RangeCalendar } from "@rivetjs/cdk/calendar";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { DatePicker, DateRangePicker } from "@rivetjs/cdk/date-picker";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Heading } from "@rivetjs/cdk/heading";
import type { CalendarDate } from "@rivetjs/cdk/date";

export const head = { title: "DOM events: dates" };

/** Global DOM events / attributes on the date components and their parts (RAC GlobalDOMAttributes). */
export default function DomEventsDatesStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const cal = signal<string | null>(null);
  const range = signal<{ start: string; end: string } | null>(null);
  const date = signal<string | null>(null);
  // Signal value plus JSX label / description: the hidden autofill input (a spread element) must not
  // capture the props object (its JSX is not serializable).
  const jsxDate = signal<string | null>("2020-02-03");
  const jsxPicked = signal<string | null>("2020-02-03");
  return (
    <I18nProvider locale="en-US">
      <section>
        <h1>DOM events: dates</h1>
        <Calendar
          id="de-cal"
          aria-label="Events"
          value={cal}
          defaultFocusedValue="2026-10-14"
          lang="en"
          dir="ltr"
          onPointerEnter={() => add("cal-enter")}
          onDblClick={() => add("cal-dbl")}
          onWheel={() => add("cal-wheel")}
        >
          <header>
            <Button slot="previous" />
            <Heading lang="en" onDblClick={() => add("heading-dbl")} />
            <Button slot="next" />
          </header>
          <CalendarGrid
            translate="no"
            onPointerDown={(e: PointerEvent) => add("grid-down:" + e.button)}
            onContextMenu={(e: MouseEvent) => {
              e.preventDefault();
              add("grid-menu");
            }}
          >
            {(day: CalendarDate) => (
              <CalendarCell date={day} lang="en" onPointerEnter={(e: PointerEvent) => add("cell-enter:" + (e.currentTarget as HTMLElement).dataset.date)} />
            )}
          </CalendarGrid>
        </Calendar>
        <p id="de-cal-value">{cal() ?? "none"}</p>
        <RangeCalendar id="de-range" aria-label="Range" value={range} defaultFocusedValue="2026-10-14" dir="ltr" onDblClick={() => add("range-dbl")}>
          <header>
            <Button slot="previous" />
            <Heading />
            <Button slot="next" />
          </header>
          <CalendarGrid onClick={() => add("range-grid-click")}>
            {(day: CalendarDate) => (
              <CalendarCell date={day} onDblClick={(e: MouseEvent) => add("range-cell-dbl:" + (e.currentTarget as HTMLElement).dataset.date)} />
            )}
          </CalendarGrid>
        </RangeCalendar>
        <p id="de-range-value">{range() ? range()!.start + ".." + range()!.end : "none"}</p>
        <DateField
          id="de-df"
          defaultValue="2020-02-03"
          lang="en"
          onPointerEnter={() => add("df-enter")}
          onContextMenu={(e: MouseEvent) => {
            e.preventDefault();
            add("df-menu");
          }}
          onFocus={() => add("df-focus")}
          onBlur={() => add("df-blur")}
          onFocusChange={(f: boolean) => add("df-focus-change:" + f)}
          onKeyDown={(e: KeyboardEvent) => add("df-key:" + e.key)}
          onKeyUp={(e: KeyboardEvent) => add("df-keyup:" + e.key)}
        >
          <Label>Field</Label>
          <DateInput dir="ltr" onDblClick={() => add("input-dbl")} onPointerUp={() => add("input-up")}>
            {(segment: DateSegmentItem) => (
              <DateSegment
                segment={segment}
                lang="en"
                onPointerEnter={(e: PointerEvent) => add("seg-enter:" + (e.currentTarget as HTMLElement).dataset.type)}
              />
            )}
          </DateInput>
        </DateField>
        <DatePicker
          id="de-dp"
          value={date}
          placeholderValue="2019-02-15"
          lang="en"
          onDblClick={() => add("dp-dbl")}
          onFocus={() => add("dp-focus")}
          onBlur={() => add("dp-blur")}
          onFocusChange={(f: boolean) => add("dp-focus-change:" + f)}
          onKeyDown={(e: KeyboardEvent) => add("dp-key:" + e.key)}
          onKeyUp={(e: KeyboardEvent) => add("dp-keyup:" + e.key)}
        >
          <Label>Picker</Label>
          <Group dir="ltr" onPointerEnter={() => add("group-enter")} onPointerUp={() => add("group-up")}>
            <DateInput>
              {(segment: DateSegmentItem) => (
                <DateSegment segment={segment} onDblClick={(e: MouseEvent) => add("dp-seg-dbl:" + (e.currentTarget as HTMLElement).dataset.type)} />
              )}
            </DateInput>
            <Button lang="en" onClick={() => add("button-click")} onPointerEnter={() => add("button-enter")} />
          </Group>
          <Popover id="de-dp-popover" lang="en" onWheel={() => add("popover-wheel")}>
            <Dialog lang="en" onDblClick={() => add("dialog-dbl")}>
              <Calendar />
            </Dialog>
          </Popover>
        </DatePicker>
        <p id="de-dp-value">{date() ?? "none"}</p>
        <DateRangePicker
          id="de-drp"
          dir="ltr"
          onContextMenu={(e: MouseEvent) => {
            e.preventDefault();
            add("drp-menu");
          }}
        >
          <Label>Range picker</Label>
          <Group>
            <DateInput slot="start" onDblClick={() => add("drp-input-dbl")}>
              {(segment: DateSegmentItem) => <DateSegment segment={segment} />}
            </DateInput>
            <span aria-hidden="true">–</span>
            <DateInput slot="end" onDblClick={() => add("drp-input-dbl")}>
              {(segment: DateSegmentItem) => <DateSegment segment={segment} />}
            </DateInput>
            <Button onDblClick={() => add("drp-button-dbl")} />
          </Group>
          <Popover>
            <Dialog>
              <RangeCalendar />
            </Dialog>
          </Popover>
        </DateRangePicker>
        <DateField id="de-jdf" value={jsxDate} name="jsx-date" autoComplete="bday" lang="en">
          <Label>
            <b>JSX field</b>
          </Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          <Text slot="description">
            <i>JSX description</i>
          </Text>
        </DateField>
        <p id="de-jdf-out">{String(jsxDate())}</p>
        <DatePicker id="de-jdp" value={jsxPicked} name="jsx-picked">
          <Label>
            <b>JSX picker</b>
          </Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button />
          </Group>
          <Text slot="description">
            <i>JSX picker description</i>
          </Text>
          <Popover>
            <Dialog>
              <Calendar />
            </Dialog>
          </Popover>
        </DatePicker>
        <p id="de-jdp-out">{String(jsxPicked())}</p>
        <button id="de-outside" type="button">
          Outside
        </button>
        {/* Last: a growing log must not move the components under the pointer. */}
        <p id="de-log">{log().join(" ")}</p>
      </section>
    </I18nProvider>
  );
}
