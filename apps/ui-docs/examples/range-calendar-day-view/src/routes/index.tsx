// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/day-view.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "RangeCalendar: Day View" };

// #region demo
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections";
import { Show } from "@rivetjs/runtime/dom";

const dayOptions = [
  { id: "1", name: "1 day" },
  { id: "5", name: "5 days" },
  { id: "7", name: "7 days" },
  { id: "8", name: "8 days" },
  { id: "10", name: "10 days" },
  { id: "14", name: "14 days" },
  { id: "21", name: "21 days" },
] as const;

export function DayView() {
  // Rivet: the Select value is a two-way key signal (upstream: useState(number) + onChange).
  const days = signal<Key | null>("5");

  return (
    <div class="flex flex-col items-center gap-6">
      <Select class="w-40" value={days}>
        <Label>Visible days</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {dayOptions.map((option) => (
              <ListBox.Item id={option.id} textValue={option.name}>
                {option.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Rivet: the function child re-creates the calendar per count (upstream: key={days}). */}
      <Show keyed when={Number(days())}>
        {(count) => (
          <RangeCalendar aria-label="Trip dates" visibleDuration={{ days: count() }}>
            <RangeCalendar.Header>
              <RangeCalendar.Heading />
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
            </RangeCalendar.Grid>
          </RangeCalendar>
        )}
      </Show>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DayView />
    </div>
  );
}
