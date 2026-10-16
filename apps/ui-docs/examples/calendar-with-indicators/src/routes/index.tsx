// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/with-indicators.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Cell Indicators" };

// #region demo
import { getLocalTimeZone, isToday } from "@rivetjs/cdk/date";

const datesWithEvents = [3, 7, 12, 15, 21, 28];

export function WithIndicators() {
  return (
    <Calendar aria-label="Event date">
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) => (
            <Calendar.Cell date={date}>
              {({ formattedDate }) => (
                <>
                  {formattedDate}
                  {(isToday(date, getLocalTimeZone()) || datesWithEvents.includes(date.day)) && <Calendar.CellIndicator />}
                </>
              )}
            </Calendar.Cell>
          )}
        </Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
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
