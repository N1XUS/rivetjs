// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Disabled" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function Disabled() {
  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar isDisabled aria-label="Event date" defaultValue={today(getLocalTimeZone())}>
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
      <Description class="text-center">Calendar is disabled</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
