// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Calendar } from "lucide";
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "DateField: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex w-full max-w-sm flex-col gap-4 rounded-3xl p-6">
      <DateField class="w-full" name="date">
        <Label>Date</Label>
        <DateField.Group variant="secondary">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Enter a date</Description>
      </DateField>
      <DateField class="w-full" name="date-2">
        <Label>Appointment date</Label>
        <DateField.Group variant="secondary">
          <DateField.Prefix>
            <Icon icon={Calendar} size={16} class="size-4 text-muted" />
          </DateField.Prefix>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Enter a date for your appointment</Description>
      </DateField>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
