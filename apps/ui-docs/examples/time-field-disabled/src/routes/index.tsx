// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Disabled State" };

// #region demo
import { Time, getLocalTimeZone, now } from "@rivetjs/cdk/date";

export function Disabled() {
  const currentTime = now(getLocalTimeZone());
  const timeValue = new Time(currentTime.hour, currentTime.minute, currentTime.second).toString();

  return (
    <div class="flex flex-col gap-4">
      <TimeField isDisabled class="w-[256px]" name="time" value={timeValue}>
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>This time field is disabled</Description>
      </TimeField>
      <TimeField isDisabled class="w-[256px]" name="time-empty">
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>This time field is disabled</Description>
      </TimeField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
