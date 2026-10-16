// Type-level suite (`tsc -p libs/ui` only): `RangeCalendar` parts accept the cdk props + `class`, controlled `{ start, end }` string
// signal, cell render props, `RangeCalendar["…Props"]`; errors: `selectionMode` (single calendars only), year cell without `year`.
import { CalendarDate } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { RangeCalendar } from "../src/components/range-calendar/index.ts";

const range = signal<{ start: string; end: string } | null>({ start: "2026-08-01", end: "2026-08-05" });

export const ok = () => (
  <RangeCalendar aria-label="Trip" value={range} minValue={new CalendarDate(2026, 1, 1)} visibleDuration={{ months: 2 }} class="w-80">
    <RangeCalendar.Header>
      <RangeCalendar.Heading />
      <RangeCalendar.NavButton slot="previous" />
      <RangeCalendar.NavButton slot="next" />
    </RangeCalendar.Header>
    <RangeCalendar.Grid offset={{ months: 1 }}>
      <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
      <RangeCalendar.GridBody>
        {(date) => (
          <RangeCalendar.Cell date={date}>{({ formattedDate, isSelectionEnd }) => (isSelectionEnd() ? `${formattedDate}!` : formattedDate)}</RangeCalendar.Cell>
        )}
      </RangeCalendar.GridBody>
    </RangeCalendar.Grid>
    <RangeCalendar.YearPickerGrid>
      <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
    </RangeCalendar.YearPickerGrid>
  </RangeCalendar>
);

const props: RangeCalendar["RootProps"] = { "aria-label": "x", defaultYearPickerOpen: true };
void props;

// @ts-expect-error no selectionMode on a range calendar
export const badMode = () => <RangeCalendar selectionMode="multiple">x</RangeCalendar>;

// @ts-expect-error YearPickerCell requires a year
export const noYear = () => <RangeCalendar.YearPickerCell />;
