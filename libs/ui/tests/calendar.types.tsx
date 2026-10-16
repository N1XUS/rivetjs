// Type-level suite (`tsc -p libs/ui` only): `Calendar` parts (+ year picker parts) accept the cdk props + `class`, controlled
// `isYearPickerOpen` signal, render-prop children, `Calendar["…Props"]`; errors: unknown `firstDayOfWeek`, bad `slot` on NavButton.
import { CalendarDate } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { Calendar } from "../src/components/calendar/index.ts";
import { CalendarYearPicker } from "../src/components/calendar-year-picker/index.ts";

const open = signal(false);
const value = signal<string | null>("2026-08-15");

export const ok = () => (
  <Calendar
    aria-label="Event date"
    value={value}
    minValue={new CalendarDate(2026, 1, 1)}
    firstDayOfWeek="mon"
    isYearPickerOpen={open}
    onYearPickerOpenChange={(o: boolean) => void o}
    class="w-80"
  >
    <Calendar.Header>
      <Calendar.YearPickerTrigger>
        {({ isOpen }) => (
          <>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator>{isOpen ? "-" : "+"}</Calendar.YearPickerTriggerIndicator>
          </>
        )}
      </Calendar.YearPickerTrigger>
      <Calendar.Heading />
      <Calendar.NavButton slot="previous" />
      <Calendar.NavButton slot="next" class="x" />
    </Calendar.Header>
    <Calendar.Grid weekdayStyle="narrow">
      <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
      <Calendar.GridBody>
        {(date) => (
          <Calendar.Cell date={date}>
            {({ formattedDate }) => (
              <>
                {formattedDate}
                <Calendar.CellIndicator />
              </>
            )}
          </Calendar.Cell>
        )}
      </Calendar.GridBody>
    </Calendar.Grid>
    <Calendar.YearPickerGrid visibleYears={12}>
      <Calendar.YearPickerGridBody>{({ year }) => <CalendarYearPicker.Cell year={year} />}</Calendar.YearPickerGridBody>
    </Calendar.YearPickerGrid>
  </Calendar>
);

const props: Calendar["RootProps"] = { "aria-label": "x", defaultYearPickerOpen: true };
void props;

// @ts-expect-error unknown firstDayOfWeek
export const badDay = () => <Calendar firstDayOfWeek="monday">x</Calendar>;

// @ts-expect-error YearPickerCell requires a year
export const noYear = () => <Calendar.YearPickerCell />;
