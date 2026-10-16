// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-picker/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <DatePicker class="w-72" name="event-date">
      <Label>Event date</Label>
      <DateField.Group fullWidth class="rounded-xl border border-border/80 bg-default shadow-sm" variant="secondary">
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger class="text-muted">
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover class="border border-border/80 shadow-sm">
        <Calendar aria-label="Event date" class="rounded-2xl bg-surface p-2">
          <Calendar.Header>
            <Calendar.Heading class="font-medium text-foreground" />
            <Calendar.NavButton class="text-muted hover:bg-default" slot="previous" />
            <Calendar.NavButton class="text-muted hover:bg-default" slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell class="text-xs text-muted">{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell class="rounded-lg data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground" date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
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
