// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-range-picker/format-options.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { Separator } from "@rivetjs/ui/separator";
import { Switch } from "@rivetjs/ui/switch";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "DateRangePicker: Format Options" };

// #region demo
import { DateFormatter, getLocalTimeZone, parseDate, parseZonedDateTime } from "@rivetjs/cdk/date";
import type { DateValue } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";
import { dateRange, setTimeRange, timeRange, type DateRangePickerState } from "@rivetjs/cdk/state/date-picker";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";

type Granularity = "day" | "hour" | "minute" | "second";
type HourCycle = 12 | 24;
type Formats = { granularity: Granularity; hourCycle: HourCycle; hideTimeZone: boolean; shouldForceLeadingZeros: boolean };
const granularityOptions: { label: string; value: Granularity }[] = [
  { label: "Day", value: "day" },
  { label: "Hour", value: "hour" },
  { label: "Minute", value: "minute" },
  { label: "Second", value: "second" },
];
const hourCycleOptions: { label: string; value: HourCycle }[] = [
  { label: "12-hour", value: 12 },
  { label: "24-hour", value: 24 },
];

type DateRange = {
  start: DateValue;
  end: DateValue;
};

/** Rivet: the popover's start / end time fields, two-way signals seeded from the picker state each time the popover opens. */
function PopoverTimes(props: { state: DateRangePickerState; formats: Formats }) {
  const state = props.state;
  const formats = props.formats;
  const initial = timeRange(state);
  const start = signal<string | null>(initial?.start?.toString() ?? null);
  const end = signal<string | null>(initial?.end?.toString() ?? null);
  const granularity = formats.granularity === "day" ? undefined : formats.granularity;

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <Label>Start Time</Label>
        <TimeField
          aria-label="Start Time"
          granularity={granularity}
          hideTimeZone={formats.hideTimeZone}
          hourCycle={formats.hourCycle}
          name="startTime"
          shouldForceLeadingZeros={formats.shouldForceLeadingZeros}
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
          aria-label="End Time"
          granularity={granularity}
          hideTimeZone={formats.hideTimeZone}
          hourCycle={formats.hourCycle}
          name="endTime"
          shouldForceLeadingZeros={formats.shouldForceLeadingZeros}
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

export function FormatOptions() {
  // Rivet: one signal of all format options; a keyed Show re-creates the picker when it changes (upstream `key={granularity}` + re-renders;
  // the cdk reads granularity / hourCycle / … once).
  const formats = signal<Formats>({ granularity: "minute", hourCycle: 12, hideTimeZone: false, shouldForceLeadingZeros: false });
  const update = (patch: Partial<Formats>) => formats.set({ ...formats(), ...patch });
  const { locale } = useLocale();
  const formatDate = (date: DateRange) => {
    const localTimeZone = getLocalTimeZone();
    const dateFormatter = new DateFormatter(locale, { day: "numeric", month: "short", year: "numeric" });

    return dateFormatter.formatRange(date.start.toDate(localTimeZone), date.end.toDate(localTimeZone));
  };

  return (
    <div class="flex w-full flex-col gap-4">
      <Show keyed when={formats()}>
        {(f) => (
          <DateRangePicker
            class="w-max min-w-80"
            defaultValue={
              f().granularity === "day"
                ? { end: parseDate("2025-02-10").toString(), start: parseDate("2025-02-03").toString() }
                : {
                    end: parseZonedDateTime(`2026-02-10T18:45:00[${getLocalTimeZone()}]`).toString(),
                    start: parseZonedDateTime(`2026-02-03T08:45:00[${getLocalTimeZone()}]`).toString(),
                  }
            }
            endName="endDate"
            granularity={f().granularity}
            hideTimeZone={f().hideTimeZone}
            hourCycle={f().hourCycle}
            shouldForceLeadingZeros={f().shouldForceLeadingZeros}
            startName="startDate"
          >
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
                  <RangeCalendar aria-label="Trip dates" class="w-full">
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
                  {f().granularity !== "day" && <PopoverTimes formats={f()} state={state} />}
                  <span class="mt-1 text-xs text-muted">
                    Selected:{" "}
                    {(() => {
                      const value = dateRange(state);

                      return value && value.start && value.end ? formatDate({ end: value.end, start: value.start }) : "No date selected";
                    })()}
                  </span>
                </DateRangePicker.Popover>
              </>
            )}
          </DateRangePicker>
        )}
      </Show>

      <Separator class="my-5" />

      <Label class="text-xs font-medium text-muted">Format Options</Label>

      {/* Rivet: uncontrolled Selects (`defaultValue` + `onChange`) feed the format signal (upstream: useState values). */}
      <div class="flex flex-wrap gap-4">
        <div class="flex flex-col gap-1">
          <Select
            class="w-[120px]"
            name="granularity"
            defaultValue={"minute"}
            variant="secondary"
            onChange={(value) => update({ granularity: value as Granularity })}
          >
            <Label>Granularity</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {granularityOptions.map((option) => (
                  <ListBox.Item id={option.value} textValue={option.label}>
                    {option.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div class="flex flex-col gap-1">
          <Select class="w-[120px]" defaultValue={12} variant="secondary" onChange={(value) => update({ hourCycle: Number(value) as HourCycle })}>
            <Label>Hour cycle</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {hourCycleOptions.map((option) => (
                  <ListBox.Item id={option.value} textValue={option.label}>
                    {option.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      <div class="flex min-w-[529px] flex-col gap-2">
        <Switch onChange={(isSelected: boolean) => update({ hideTimeZone: isSelected })}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Hide timezone
          </Switch.Content>
        </Switch>
        <Switch onChange={(isSelected: boolean) => update({ shouldForceLeadingZeros: isSelected })}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Force leading zeros
          </Switch.Content>
        </Switch>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormatOptions />
    </div>
  );
}
