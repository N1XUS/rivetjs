import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, CalendarHeading } from "@rivetjs/cdk/calendar";
import { RangeCalendar } from "@rivetjs/cdk/range-calendar";

export const head = { title: "Calendar" };

export default function CalendarStory() {
  const date = signal<string | null>("2026-10-14");
  const range = signal<{ start: string; end: string } | null>({ start: "2026-10-05", end: "2026-10-09" });
  const many = signal<string[]>([]);
  const focused = signal("2026-10-14");
  const invalid = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <section>
        <h1>Calendar</h1>
        <Calendar id="cal" aria-label="Event date" value={date} />
        <p id="cal-value">Value: {date() ?? "none"}</p>
        <Calendar
          id="cal-min"
          aria-label="Bounded"
          defaultValue="2026-10-14"
          minValue="2026-10-10"
          maxValue="2026-11-20"
          isDateUnavailable={(d: CalendarDate) => d.day === 13}
        />
        <Calendar id="cal-two" aria-label="Two months" defaultValue="2026-10-14" visibleDuration={{ months: 2 }} pageBehavior="single" />
        <I18nProvider locale="de-DE">
          <Calendar id="cal-de" aria-label="Datum" defaultValue="2026-10-14" />
        </I18nProvider>
        <Calendar id="cal-multi" aria-label="Many" selectionMode="multiple" value={many} defaultFocusedValue="2026-10-14" />
        <p id="multi-value">Many: {many().join(",")}</p>
        <div dir="rtl">
          <I18nProvider locale="ar-EG">
            <Calendar id="cal-ar" aria-label="RTL" defaultValue="2026-10-14" />
          </I18nProvider>
        </div>
        <h2>Composed parts</h2>
        <Calendar
          id="cal-parts"
          aria-label="Parts"
          focusedValue={focused}
          defaultValue="2026-10-14"
          class={({ isInvalid }) => (isInvalid() ? "parts invalid" : "parts")}
        >
          <header>
            <Button slot="previous">Previous</Button>
            <CalendarHeading />
            <Button slot="next">Next</Button>
          </header>
          <CalendarGrid weekdayStyle="short">
            <CalendarGridHeader>{(day: string) => <CalendarHeaderCell class="weekday">{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody>
              {(d: CalendarDate) => (
                <CalendarCell date={d} class={({ isSelected, isHovered }) => "cell" + (isSelected() ? " sel" : "") + (isHovered() ? " hov" : "")} />
              )}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
        <button id="focus-december" type="button" onClick={() => focused.set("2026-12-24")}>
          Focus December
        </button>
        <Calendar id="cal-invalid" aria-label="Invalid" value={invalid} isInvalid>
          <CalendarGrid>{(d: CalendarDate) => <CalendarCell date={d} />}</CalendarGrid>
          <Text slot="errorMessage">Pick another date</Text>
        </Calendar>
        <h2>RangeCalendar</h2>
        <RangeCalendar id="range" aria-label="Trip" value={range} />
        <p id="range-value">Range: {range() ? range()!.start + ".." + range()!.end : "none"}</p>
        <div class="spacer"></div>
      </section>
    </I18nProvider>
  );
}
