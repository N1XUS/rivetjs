// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/read-only.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Read Only" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function ReadOnly() {
  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar
        isReadOnly
        aria-label="Trip dates"
        defaultValue={{
          end: today(getLocalTimeZone()).add({ days: 4 }),
          start: today(getLocalTimeZone()),
        }}
      >
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
      <Description class="text-center">Range calendar is read-only</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ReadOnly />
    </div>
  );
}
