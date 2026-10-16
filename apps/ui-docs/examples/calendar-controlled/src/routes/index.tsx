// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Controlled" };

// #region demo
import { getLocalTimeZone, parseDate, startOfMonth, startOfWeek, today } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";
import { signal } from "@rivetjs/reactivity";

export function Controlled() {
  // Rivet: controlled values are two-way signals of the date strings (no onChange / onFocusChange setters needed).
  const value = signal<string | null>(null);
  const focusedDate = signal("2025-12-25");
  const { locale } = useLocale();

  return (
    <div class="flex flex-col items-center gap-4">
      <ButtonGroup fullWidth size="sm" variant="tertiary">
        <Button
          onPress={() => {
            const todayDate = today(getLocalTimeZone()).toString();

            value.set(todayDate);
            focusedDate.set(todayDate);
          }}
        >
          Today
        </Button>
        <Button
          onPress={() => {
            const nextWeekStart = startOfWeek(today(getLocalTimeZone()), locale).toString();

            value.set(nextWeekStart);
            focusedDate.set(nextWeekStart);
          }}
        >
          Week
        </Button>
        <Button
          onPress={() => {
            const nextMonthStart = startOfMonth(today(getLocalTimeZone())).toString();

            value.set(nextMonthStart);
            focusedDate.set(nextMonthStart);
          }}
        >
          Month
        </Button>
      </ButtonGroup>

      <Calendar aria-label="Event date" focusedValue={focusedDate} value={value}>
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

      <Description class="text-center">Selected date: {value() ? parseDate(value()!).toString() : "(none)"}</Description>

      <div class="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const todayDate = today(getLocalTimeZone()).toString();

            value.set(todayDate);
            focusedDate.set(todayDate);
          }}
        >
          Set Today
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            value.set("2025-12-25");
            focusedDate.set("2025-12-25");
          }}
        >
          Set Christmas
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
