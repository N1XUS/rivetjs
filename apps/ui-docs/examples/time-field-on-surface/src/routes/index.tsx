// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Clock } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Surface } from "@rivetjs/ui/surface";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: On Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex w-full max-w-sm flex-col gap-4 rounded-3xl p-6">
      <TimeField class="w-full" name="time">
        <Label>Time</Label>
        <TimeField.Group variant="secondary">
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Enter a time</Description>
      </TimeField>
      <TimeField class="w-full" name="time-2">
        <Label>Appointment time</Label>
        <TimeField.Group variant="secondary">
          <TimeField.Prefix>
            <Icon icon={Clock} size={16} class="size-4 text-muted" />
          </TimeField.Prefix>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Enter a time for your appointment</Description>
      </TimeField>
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
