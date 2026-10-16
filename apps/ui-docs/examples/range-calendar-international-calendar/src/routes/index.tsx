// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/international-calendar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: International Calendars" };

// #region demo
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";

export function InternationalCalendar() {
  return (
    <I18nProvider locale="hi-IN-u-ca-indian">
      <RangeCalendar aria-label="Trip dates">
        <RangeCalendar.Header>
          <RangeCalendar.YearPickerTrigger>
            <RangeCalendar.YearPickerTriggerHeading />
            <RangeCalendar.YearPickerTriggerIndicator />
          </RangeCalendar.YearPickerTrigger>
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
        <RangeCalendar.YearPickerGrid>
          <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
        </RangeCalendar.YearPickerGrid>
      </RangeCalendar>
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
