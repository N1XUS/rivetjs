// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/with-indicators.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Cell Indicators" };

// #region demo
import { getLocalTimeZone, isToday } from "@rivetjs/cdk/date";

const datesWithEvents = [3, 7, 12, 15, 21, 28];

export function WithIndicators() {
  return (
    <RangeCalendar aria-label="Trip dates">
      <RangeCalendar.Header>
        <RangeCalendar.Heading />
        <RangeCalendar.NavButton slot="previous" />
        <RangeCalendar.NavButton slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>
          {(date) => (
            <RangeCalendar.Cell date={date}>
              {({ formattedDate }) => (
                <>
                  {formattedDate}
                  {(isToday(date, getLocalTimeZone()) || datesWithEvents.includes(date.day)) && <RangeCalendar.CellIndicator />}
                </>
              )}
            </RangeCalendar.Cell>
          )}
        </RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </RangeCalendar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIndicators />
    </div>
  );
}
