// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/multiple-selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Multiple Selection" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function MultipleSelection() {
  // Rivet: selectionMode="multiple" — a two-way signal of the date strings.
  const value = signal<string[]>([]);

  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Event dates" selectionMode="multiple" value={value}>
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
      <Description class="text-center">{value().length ? `${value().length} date(s) selected` : "Select multiple dates"}</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MultipleSelection />
    </div>
  );
}
