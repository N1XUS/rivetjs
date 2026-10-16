// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-picker/format-options.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Switch } from "@rivetjs/ui/switch";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "DatePicker: Format Options" };

// #region demo
import { getLocalTimeZone, parseDate, parseZonedDateTime } from "@rivetjs/cdk/date";
import { setTimeValue, timeValue, type DatePickerState } from "@rivetjs/cdk/state/date-picker";
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

/** Rivet: the popover's time field, a two-way signal seeded from the picker state each time the popover opens. */
function PopoverTime(props: { state: DatePickerState; formats: Formats }) {
  const state = props.state;
  const formats = props.formats;
  const time = signal<string | null>(timeValue(state)?.toString() ?? null);

  return (
    <div class="flex items-center justify-between">
      <Label>Time</Label>
      <TimeField
        aria-label="Time"
        granularity={formats.granularity === "day" ? undefined : formats.granularity}
        hideTimeZone={formats.hideTimeZone}
        hourCycle={formats.hourCycle}
        name="time"
        shouldForceLeadingZeros={formats.shouldForceLeadingZeros}
        value={time}
        onChange={(v) => {
          if (v) setTimeValue(state, v);
        }}
      >
        <TimeField.Group variant="secondary">
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
      </TimeField>
    </div>
  );
}

export function FormatOptions() {
  // Rivet: one signal of all format options; a keyed Show re-creates the picker when it changes (upstream `key={granularity}` + re-renders;
  // the cdk reads granularity / hourCycle / … once).
  const formats = signal<Formats>({ granularity: "minute", hourCycle: 12, hideTimeZone: false, shouldForceLeadingZeros: false });
  const update = (patch: Partial<Formats>) => formats.set({ ...formats(), ...patch });

  return (
    <div class="flex flex-col gap-4">
      <Show keyed when={formats()}>
        {(f) => (
          <DatePicker
            class="w-fit min-w-72"
            defaultValue={f().granularity === "day" ? parseDate("2026-02-03") : parseZonedDateTime(`2026-02-03T08:45:00[${getLocalTimeZone()}]`)}
            granularity={f().granularity}
            hideTimeZone={f().hideTimeZone}
            hourCycle={f().hourCycle}
            name="date"
            shouldForceLeadingZeros={f().shouldForceLeadingZeros}
          >
            {({ state }) => (
              <>
                <Label>Date and time</Label>
                <DateField.Group fullWidth>
                  <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover class="flex flex-col gap-3">
                  <Calendar aria-label="Event date">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
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
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                  {f().granularity !== "day" && <PopoverTime formats={f()} state={state} />}
                </DatePicker.Popover>
              </>
            )}
          </DatePicker>
        )}
      </Show>

      {/* Rivet: uncontrolled Selects (`defaultValue` + `onChange`) feed the format signal (upstream: useState values). */}
      <div class="flex flex-wrap gap-4">
        <div class="flex flex-col gap-1">
          <Select class="w-[120px]" defaultValue={"minute"} variant="secondary" onChange={(value) => update({ granularity: value as Granularity })}>
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

      <div class="flex min-w-80 flex-col gap-2">
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
