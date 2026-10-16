// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Controlled" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

type DateRange = {
  start: string;
  end: string;
};

export function Controlled() {
  const start = today(getLocalTimeZone());
  // Rivet: a controlled value is a two-way signal of `{ start, end }` date strings.
  const value = signal<DateRange | null>({ end: start.add({ days: 4 }).toString(), start: start.toString() });

  return (
    <div class="flex w-80 flex-col gap-4">
      <DateRangePicker endName="endDate" startName="startDate" value={value}>
        <Label>Trip dates</Label>
        <DateField.Group fullWidth>
          <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DateRangePicker.Trigger>
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DateRangePicker.Popover>
          <RangeCalendar aria-label="Trip dates">
            <RangeCalendar.Header>
              <RangeCalendar.YearPickerTrigger>
                <RangeCalendar.YearPickerTriggerHeading />
                <RangeCalendar.YearPickerTriggerIndicator />
              </RangeCalendar.YearPickerTrigger>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
            </RangeCalendar.Grid>
            <RangeCalendar.YearPickerGrid>
              <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
            </RangeCalendar.YearPickerGrid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>
      <Description>Current value: {value() ? `${value()!.start} -> ${value()!.end}` : "(empty)"}</Description>
      <div class="flex gap-2">
        <Button
          variant="tertiary"
          onPress={() => {
            const nextStart = today(getLocalTimeZone());

            value.set({ end: nextStart.add({ days: 6 }).toString(), start: nextStart.toString() });
          }}
        >
          Set week
        </Button>
        <Button variant="tertiary" onPress={() => value.set(null)}>
          Clear
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
