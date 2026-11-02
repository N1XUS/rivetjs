// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/release-input-container.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "DateRangePicker: Input Container" };

// #region demo
import { getLocalTimeZone, parseZonedDateTime } from "@rivetjs/cdk/date";
import { setTimeRange, timeRange, type DateRangePickerState } from "@rivetjs/cdk/state/date-picker";
import { signal } from "@rivetjs/reactivity";

/** Rivet: two-way signals seeded from the picker state each time the popover opens (upstream: `state.timeRange` values). */
function PopoverTimes(props: { state: DateRangePickerState }) {
  const state = props.state;
  const initial = timeRange(state);
  const start = signal<string | null>(initial?.start?.toString() ?? null);
  const end = signal<string | null>(initial?.end?.toString() ?? null);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <Label>Start Time</Label>
        <TimeField
          shouldForceLeadingZeros
          aria-label="Start Time"
          granularity="second"
          hourCycle={12}
          value={start}
          onChange={(v) => setTimeRange(state, { end: timeRange(state)?.end ?? null, start: v })}
        >
          <TimeField.Group variant="secondary">
            <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          </TimeField.Group>
        </TimeField>
      </div>
      <div class="flex items-center justify-between">
        <Label>End Time</Label>
        <TimeField
          shouldForceLeadingZeros
          aria-label="End Time"
          granularity="second"
          hourCycle={12}
          value={end}
          onChange={(v) => setTimeRange(state, { end: v, start: timeRange(state)?.start ?? null })}
        >
          <TimeField.Group variant="secondary">
            <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          </TimeField.Group>
        </TimeField>
      </div>
    </div>
  );
}

export function InputContainer() {
  const zone = getLocalTimeZone();
  const defaultValue = {
    end: parseZonedDateTime(`2026-02-10T18:45:00[${zone}]`).toString(),
    start: parseZonedDateTime(`2026-02-03T08:45:00[${zone}]`).toString(),
  };

  return (
    <DateRangePicker shouldForceLeadingZeros class="w-full max-w-2xs min-w-80" defaultValue={defaultValue} granularity="second" hourCycle={12}>
      {({ state }) => (
        <>
          <Label>Date range</Label>
          <DateField.Group>
            <DateField.InputContainer>
              <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            </DateField.InputContainer>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover class="flex w-full max-w-63 flex-col gap-3">
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
            <PopoverTimes state={state} />
          </DateRangePicker.Popover>
        </>
      )}
    </DateRangePicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InputContainer />
    </div>
  );
}
