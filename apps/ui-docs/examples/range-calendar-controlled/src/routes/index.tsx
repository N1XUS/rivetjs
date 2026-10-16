// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Description } from "@rivetjs/ui/description";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Controlled" };

// #region demo
import { getLocalTimeZone, parseDate, startOfMonth, startOfWeek, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { useLocale } from "@rivetjs/cdk/i18n";

export function Controlled() {
  // Rivet: controlled values are two-way signals of the date strings (no onChange / onFocusChange setters needed).
  const value = signal<{ start: string; end: string } | null>(null);
  const focusedDate = signal("2025-12-25");
  const { locale } = useLocale();

  return (
    <div class="flex flex-col items-center gap-4">
      <ButtonGroup variant="tertiary">
        <Button
          onPress={() => {
            const start = today(getLocalTimeZone());

            focusedDate.set(start.toString());
          }}
        >
          This week
        </Button>
        <Button
          onPress={() => {
            const nextWeekStart = startOfWeek(today(getLocalTimeZone()).add({ weeks: 1 }), locale);

            focusedDate.set(nextWeekStart.toString());
          }}
        >
          Next week
        </Button>
        <Button
          onPress={() => {
            const nextMonthStart = startOfMonth(today(getLocalTimeZone()).add({ months: 1 }));

            focusedDate.set(nextMonthStart.toString());
          }}
        >
          Next month
        </Button>
      </ButtonGroup>

      <RangeCalendar aria-label="Trip dates" firstDayOfWeek="mon" focusedValue={focusedDate} value={value}>
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

      <Description class="text-center">
        Selected range: {value() ? `${parseDate(value()!.start).toString()} -> ${parseDate(value()!.end).toString()}` : "(none)"}
      </Description>

      <div class="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const start = today(getLocalTimeZone());

            value.set({ end: start.add({ days: 6 }).toString(), start: start.toString() });
            focusedDate.set(start.toString());
          }}
        >
          Set 1 week
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            value.set({ end: "2025-12-31", start: "2025-12-20" });
            focusedDate.set("2025-12-20");
          }}
        >
          Set Holidays
        </Button>
        <Button size="sm" variant="tertiary" onPress={() => value.set(null)}>
          Clear
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
