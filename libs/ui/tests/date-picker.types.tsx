// Type-level suite (`tsc -p libs/ui` only): `DatePicker` / `DateRangePicker` parts accept the cdk props + `class`, controlled value
// signals (string / `{ start, end }`), render-prop children, `DatePicker["…Props"]`; errors: bad `placement`, unknown prop on the separator.
import { CalendarDate } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { DatePicker } from "../src/components/date-picker/index.ts";
import { DateRangePicker } from "../src/components/date-range-picker/index.ts";

const value = signal<string | null>("2026-08-15");
const range = signal<{ start: string; end: string } | null>({ start: "2026-08-01", end: "2026-08-05" });

export const ok = () => (
  <>
    <DatePicker value={value} minValue={new CalendarDate(2026, 1, 1)} name="d" class="w-72" onOpenChange={(o) => void o} isRequired>
      {({ isOpen }) => (
        <>
          <DatePicker.Trigger class="t">{isOpen() ? "close" : "open"}</DatePicker.Trigger>
          <DatePicker.TriggerIndicator class="i" />
          <DatePicker.Popover placement="bottom end" class="p">
            x
          </DatePicker.Popover>
        </>
      )}
    </DatePicker>
    <DateRangePicker value={range} startName="s" endName="e">
      <DateRangePicker.RangeSeparator class="s">to</DateRangePicker.RangeSeparator>
      <DateRangePicker.Popover>x</DateRangePicker.Popover>
    </DateRangePicker>
  </>
);

export const props: [DatePicker["Props"], DatePicker["PopoverProps"], DateRangePicker["RangeSeparatorProps"]] = [{}, { children: "x" }, {}];

export const bad = () => (
  <>
    {/* @ts-expect-error bad placement */}
    <DatePicker.Popover placement="middle">x</DatePicker.Popover>
    {/* @ts-expect-error unknown prop */}
    <DateRangePicker.RangeSeparator nope={1} />
  </>
);
