// Date / time fields on a resumed page (P3-DATE-COLOR; ids on wrappers: a field's `id` names its group, RAC): `#df` DateField (default 2026-08-15, `onChange` → `#df-value`), `#df-empty`
// empty DateField (typing builds a date, `onChange` → `#df-empty-value`), `#tf` TimeField (default 09:30, `onChange` → `#tf-value`),
// `#dp` DatePicker (default 2026-08-15, `onChange` → `#dp-value`), `#drp` DateRangePicker (2026-08-03 … 07, `onChange` → `#drp-value`).
import { signal } from "@rivetjs/reactivity";
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { TimeField } from "@rivetjs/ui/time-field";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { parseDate, Time } from "@rivetjs/cdk/date";

export default function DateStories() {
  const picked = signal("");
  const typed = signal("");
  const time = signal("");
  const day = signal("");
  const range = signal("");
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="df">
        <DateField class="w-64" name="date" defaultValue={parseDate("2026-08-15")} onChange={(d) => picked.set(String(d))}>
          <Label>Date</Label>
          <DateField.Group>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          </DateField.Group>
          <Description>Enter a date</Description>
        </DateField>
      </div>
      <output id="df-value">{picked()}</output>
      <div id="df-empty">
        <DateField class="w-64" name="typed" onChange={(d) => typed.set(String(d))}>
          <Label>Typed date</Label>
          <DateField.Group>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          </DateField.Group>
        </DateField>
      </div>
      <output id="df-empty-value">{typed()}</output>
      <div id="tf">
        <TimeField
          class="w-64"
          name="time"
          defaultValue={new Time(9, 30)}
          onChange={(t) => time.set(t ? `${t.hour}:${String(t.minute).padStart(2, "0")}` : "")}
        >
          <Label>Time</Label>
          <TimeField.Group>
            <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          </TimeField.Group>
        </TimeField>
      </div>
      <output id="tf-value">{time()}</output>
      <div id="dp">
        <DatePicker class="w-72" name="picked" defaultValue={parseDate("2026-08-15")} onChange={(d) => day.set(String(d))}>
          <Label>Event date</Label>
          <DateField.Group fullWidth>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateField.Suffix>
              <DatePicker.Trigger aria-label="Open calendar">
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DatePicker.Popover>
            <Calendar aria-label="Event date">
              <Calendar.Header>
                <Calendar.Heading />
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>{(d) => <Calendar.HeaderCell>{d}</Calendar.HeaderCell>}</Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>
      </div>
      <output id="dp-value">{day()}</output>
      <div id="drp">
        <DateRangePicker
          class="w-80"
          endName="end"
          startName="start"
          defaultValue={{ start: parseDate("2026-08-03"), end: parseDate("2026-08-07") }}
          onChange={(r) => range.set(r ? `${r.start}/${r.end}` : "")}
        >
          <Label>Trip dates</Label>
          <DateField.Group fullWidth>
            <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateRangePicker.RangeSeparator />
            <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateField.Suffix>
              <DateRangePicker.Trigger aria-label="Open range calendar">
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <RangeCalendar aria-label="Trip dates">
              <RangeCalendar.Header>
                <RangeCalendar.Heading />
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>{(d) => <RangeCalendar.HeaderCell>{d}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </DateRangePicker.Popover>
        </DateRangePicker>
      </div>
      <output id="drp-value">{range()}</output>
    </section>
  );
}
