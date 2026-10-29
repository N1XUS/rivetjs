// Rivet-authored DateInputGroup demo (own content): the group parts used directly inside DateField and TimeField.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { DateField } from "@rivetjs/ui/date-field";
import { DateInputGroup } from "@rivetjs/ui/date-input-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";
import { CalendarDays, Clock } from "lucide";

export const head = { title: "DateInputGroup: Parts" };

// #region demo
export function Parts() {
  const day = signal<string | null>("2026-03-14");

  return (
    <div class="flex w-full max-w-xs flex-col gap-6">
      {/* One group in a DateField: prefix icon, segments, suffix text. */}
      <DateField id="dig-day" name="day" value={day}>
        <Label>Delivery day</Label>
        <DateInputGroup>
          <DateInputGroup.Prefix>
            <Icon icon={CalendarDays} size={16} class="text-muted" />
          </DateInputGroup.Prefix>
          <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          <DateInputGroup.Suffix>
            <span class="text-xs text-muted">local</span>
          </DateInputGroup.Suffix>
        </DateInputGroup>
        <Description id="dig-day-value">Value: {day() ?? "(empty)"}</Description>
      </DateField>

      {/* The same parts in a TimeField, secondary and full width. */}
      <TimeField name="slot" defaultValue="09:30">
        <Label>Time slot</Label>
        <DateInputGroup variant="secondary" fullWidth>
          <DateInputGroup.Prefix>
            <Icon icon={Clock} size={16} class="text-muted" />
          </DateInputGroup.Prefix>
          <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
        </DateInputGroup>
      </TimeField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Parts />
    </div>
  );
}
