// Calendar on a resumed page (P3-DATE-COLOR): `#cal` year-picker calendar (default value 2026-08-15, `onChange` → `#cal-value`),
// `#cal-plain` basic calendar (header + nav buttons, focusedValue 2026-08-01); `#rc` RangeCalendar (default 2026-08-03 … 2026-08-07,
// `onChange` → `#rc-value`).
import { signal } from "@rivetjs/reactivity";
import { Calendar } from "@rivetjs/ui/calendar";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { parseDate } from "@rivetjs/cdk/date";

export default function CalendarStories() {
  const picked = signal("");
  const range = signal("");
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <Calendar id="cal" aria-label="Event date" defaultValue={parseDate("2026-08-15")} onChange={(d) => picked.set(String(d))}>
        <Calendar.Header>
          <Calendar.YearPickerTrigger id="cal-trigger">
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
        <Calendar.YearPickerGrid id="cal-years">
          <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
        </Calendar.YearPickerGrid>
      </Calendar>
      <output id="cal-value">{() => picked()}</output>

      <Calendar id="cal-plain" aria-label="Plain" defaultFocusedValue={parseDate("2026-08-01")}>
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton id="cal-prev" slot="previous" />
          <Calendar.NavButton id="cal-next" slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

      <RangeCalendar
        id="rc"
        aria-label="Trip dates"
        defaultValue={{ start: parseDate("2026-08-03"), end: parseDate("2026-08-07") }}
        onChange={(v) => range.set(`${v.start}/${v.end}`)}
      >
        <RangeCalendar.Header>
          <RangeCalendar.Heading />
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton id="rc-next" slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </RangeCalendar>
      <output id="rc-value">{() => range()}</output>
    </section>
  );
}
