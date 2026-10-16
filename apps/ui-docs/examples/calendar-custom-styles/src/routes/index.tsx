// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/calendar/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";

export const head = { title: "Calendar: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Calendar
      aria-label="Custom styled calendar"
      class="w-63 rounded-2xl border border-border/80 bg-surface p-3 shadow-sm ring-1 ring-accent/5 dark:border-border/90 dark:ring-accent/10"
    >
      <Calendar.Header class="px-0.5 pb-4">
        <Calendar.Heading class="text-sm font-medium text-foreground" />
        <Calendar.NavButton class="text-accent-soft-foreground hover:bg-default hover:text-accent-soft-foreground active:scale-95" slot="previous" />
        <Calendar.NavButton class="text-accent-soft-foreground hover:bg-default hover:text-accent-soft-foreground active:scale-95" slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell class="pb-2 text-xs font-medium text-muted">{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) => (
            <Calendar.Cell
              class="rounded-3xl hover:bg-default data-[hovered=true]:bg-default data-[outside-month=true]:text-muted data-[outside-month=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[selected=true]:hover:bg-accent-hover data-[selected=true]:data-[hovered=true]:bg-accent-hover data-[selected=true]:data-[outside-month=true]:bg-default data-[today=true]:bg-accent-soft data-[today=true]:text-accent-soft-foreground data-[today=true]:hover:bg-accent-soft-hover data-[today=true]:data-[hovered=true]:bg-accent-soft-hover data-[selected=true]:data-[today=true]:bg-accent data-[selected=true]:data-[today=true]:hover:bg-accent-hover"
              date={date}
            />
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
      <CustomStyles />
    </div>
  );
}
