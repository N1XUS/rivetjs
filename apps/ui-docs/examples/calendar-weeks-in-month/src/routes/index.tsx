// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/weeks-in-month.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Weeks in Month" };

// #region demo
export function WeeksInMonth() {
  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Event date" weeksInMonth={6}>
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
      <Description class="text-center">Always shows 6 weeks per month to avoid layout shift when navigating</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WeeksInMonth />
    </div>
  );
}
