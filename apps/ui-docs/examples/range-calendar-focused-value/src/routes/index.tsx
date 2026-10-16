// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/focused-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Focused Value" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function FocusedValue() {
  // Rivet: a two-way signal of the focused date string.
  const focusedDate = signal("2025-06-15");

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar aria-label="Trip dates" firstDayOfWeek="mon" focusedValue={focusedDate}>
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
      <Description class="text-center">Focused: {focusedDate()}</Description>
      <div class="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="secondary" onPress={() => focusedDate.set("2025-01-01")}>
          Go to Jan
        </Button>
        <Button size="sm" variant="secondary" onPress={() => focusedDate.set("2025-06-15")}>
          Go to Jun
        </Button>
        <Button size="sm" variant="secondary" onPress={() => focusedDate.set("2025-12-25")}>
          Go to Christmas
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FocusedValue />
    </div>
  );
}
