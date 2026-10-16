// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/international-calendar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: International Calendars" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";

export function InternationalCalendar() {
  return (
    <I18nProvider locale="hi-IN-u-ca-indian">
      <Calendar aria-label="Event date" defaultValue={today(getLocalTimeZone())}>
        <Calendar.Header>
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
        <Calendar.YearPickerGrid>
          <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
        </Calendar.YearPickerGrid>
      </Calendar>
    </I18nProvider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InternationalCalendar />
    </div>
  );
}
