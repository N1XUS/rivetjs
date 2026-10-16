// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Invalid" };

// #region demo
import { getLocalTimeZone, parseDate, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function Invalid() {
  const now = today(getLocalTimeZone());
  const value = signal<{ start: string; end: string } | null>({
    end: now.add({ days: 14 }).toString(),
    start: now.add({ days: 6 }).toString(),
  });
  const isInvalid = () => {
    const range = value();

    return range != null && parseDate(range.end).compare(parseDate(range.start)) > 7;
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <RangeCalendar aria-label="Trip dates" firstDayOfWeek="mon" isInvalid={isInvalid()} value={value}>
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
      {isInvalid() ? (
        <p class="text-sm text-danger">Maximum stay duration is 1 week</p>
      ) : (
        <Description class="text-center">Select a stay of up to 7 days</Description>
      )}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Invalid />
    </div>
  );
}
