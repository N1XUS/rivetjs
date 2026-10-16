// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/range-calendar/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export const head = { title: "RangeCalendar: Tailwind CSS" };

// #region demo
import { parseDate } from "@rivetjs/cdk/date";

const cellClassName = [
  "rounded-md",
  "**:data-[slot=range-calendar-cell-button]:rounded-md",
  "data-[outside-month=true]:text-muted data-[outside-month=true]:opacity-50",
  "data-[hovered=true]:not-data-[selected=true]:**:data-[slot=range-calendar-cell-button]:bg-default",
  "data-[today=true]:**:data-[slot=range-calendar-cell-button]:bg-success-soft",
  "data-[today=true]:**:data-[slot=range-calendar-cell-button]:text-success-soft-foreground",
  "data-[today=true]:data-[hovered=true]:not-data-[selected=true]:**:data-[slot=range-calendar-cell-button]:bg-success-soft-hover",
  "data-[selected=true]:rounded-none data-[selected=true]:bg-success-soft",
  "data-[outside-month=true]:data-[selected=true]:bg-default/20",
  "data-[selection-start=true]:rounded-tl-md data-[selection-start=true]:rounded-bl-md",
  "data-[selection-end=true]:rounded-tr-md data-[selection-end=true]:rounded-br-md",
  "data-[selection-start=true]:**:data-[slot=range-calendar-cell-button]:bg-success",
  "data-[selection-start=true]:**:data-[slot=range-calendar-cell-button]:text-success-foreground",
  "data-[selection-start=true]:data-[pressed=true]:**:data-[slot=range-calendar-cell-button]:bg-success-hover",
  "data-[selection-end=true]:**:data-[slot=range-calendar-cell-button]:bg-success",
  "data-[selection-end=true]:**:data-[slot=range-calendar-cell-button]:text-success-foreground",
  "data-[selection-end=true]:data-[pressed=true]:**:data-[slot=range-calendar-cell-button]:bg-success-hover",
].join(" ");

export function CustomStyles() {
  return (
    <RangeCalendar
      aria-label="Hotel stay"
      class="w-63 rounded-xl border border-border/80 bg-surface p-3 shadow-sm ring-1 ring-success/10"
      defaultValue={{ end: parseDate("2025-02-14"), start: parseDate("2025-02-08") }}
      firstDayOfWeek="mon"
    >
      <RangeCalendar.Header class="px-0.5 pb-4">
        <RangeCalendar.Heading class="text-sm font-medium text-foreground" />
        <RangeCalendar.NavButton class="rounded-md text-success hover:bg-success-soft active:scale-95" slot="previous" />
        <RangeCalendar.NavButton class="rounded-md text-success hover:bg-success-soft active:scale-95" slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>
          {(day) => <RangeCalendar.HeaderCell class="pb-2 text-xs font-medium text-muted">{day}</RangeCalendar.HeaderCell>}
        </RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell class={cellClassName} date={date} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </RangeCalendar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
