// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="flex flex-col gap-4">
      <TimeField class="w-[256px]" name="time">
        <Label>Start time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Enter the start time</Description>
      </TimeField>
      <TimeField class="w-[256px]" name="end-time">
        <Label>End time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Enter the end time</Description>
      </TimeField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
