// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/week-view.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "RangeCalendar: Week View" };

// #region demo
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections";
import { Show } from "@rivetjs/runtime/dom";

const weekOptions = [
  { id: "1", name: "1 week" },
  { id: "2", name: "2 weeks" },
  { id: "3", name: "3 weeks" },
  { id: "4", name: "4 weeks" },
  { id: "5", name: "5 weeks" },
  { id: "6", name: "6 weeks" },
  { id: "8", name: "8 weeks" },
] as const;

export function WeekView() {
  // Rivet: the Select value is a two-way key signal (upstream: useState(number) + onChange).
  const weeks = signal<Key | null>("1");

  return (
    <div class="flex flex-col items-center gap-6">
      <Select class="w-40" value={weeks}>
        <Label>Visible weeks</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {weekOptions.map((option) => (
              <ListBox.Item id={option.id} textValue={option.name}>
                {option.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Rivet: the function child re-creates the calendar per count (upstream: key={weeks}). */}
      <Show keyed when={Number(weeks())}>
        {(count) => (
          <RangeCalendar aria-label="Trip dates" visibleDuration={{ weeks: count() }}>
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
      <WeekView />
    </div>
  );
}
