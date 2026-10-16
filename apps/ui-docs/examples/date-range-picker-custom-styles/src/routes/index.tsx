// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "DateRangePicker: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <DateRangePicker class="w-80" endName="checkout" startName="checkin">
      <Label>Stay dates</Label>
      <DateField.Group fullWidth class="rounded-xl border border-border/80 bg-default shadow-sm" variant="secondary">
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator class="text-muted" />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DateRangePicker.Trigger class="text-muted">
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover class="border border-border/80 shadow-sm">
        <RangeCalendar aria-label="Stay dates" class="rounded-2xl bg-surface p-2">
          <RangeCalendar.Header>
            <RangeCalendar.Heading class="font-medium text-foreground" />
            <RangeCalendar.NavButton class="text-muted hover:bg-default" slot="previous" />
            <RangeCalendar.NavButton class="text-muted hover:bg-default" slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => <RangeCalendar.HeaderCell class="text-xs text-muted">{day}</RangeCalendar.HeaderCell>}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
