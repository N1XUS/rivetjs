// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Controlled" };

// #region demo
import { Time, getLocalTimeZone, now } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the time string (no onChange setter needed).
  const value = signal<string | null>(null);

  return (
    <div class="flex flex-col gap-4">
      <TimeField class="w-[256px]" name="time" value={value}>
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Current value: {value() ?? "(empty)"}</Description>
      </TimeField>
      <div class="flex gap-2">
        <Button
          variant="tertiary"
          onPress={() => {
            const currentTime = now(getLocalTimeZone());

            value.set(new Time(currentTime.hour, currentTime.minute, currentTime.second).toString());
          }}
        >
          Set now
        </Button>
        <Button variant="tertiary" onPress={() => value.set(null)}>
          Clear
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
