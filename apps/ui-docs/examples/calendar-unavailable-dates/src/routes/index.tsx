// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/unavailable-dates.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Calendar: Unavailable Dates" };

// #region demo
import type { DateValue } from "@rivetjs/cdk/date";

import { isWeekend } from "@rivetjs/cdk/date";
import { useLocale } from "@rivetjs/cdk/i18n";

export function UnavailableDates() {
  const { locale } = useLocale();
  const isDateUnavailable = (date: DateValue) => isWeekend(date, locale);

  return (
    <div class="flex flex-col items-center gap-4">
      <Calendar aria-label="Appointment date" isDateUnavailable={isDateUnavailable}>
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
      <Description class="text-center">Weekends are unavailable</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <UnavailableDates />
    </div>
  );
}
