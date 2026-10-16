// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/focused-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Focused Value" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function FocusedValue() {
  // Rivet: a two-way signal of the focused date string.
  const focusedDate = signal("2025-06-15");

  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Event date" focusedValue={focusedDate}>
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

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
