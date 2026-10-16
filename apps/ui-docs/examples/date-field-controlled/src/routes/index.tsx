// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Controlled" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the date string (no onChange setter needed).
  const value = signal<string | null>(null);

  return (
    <div class="flex flex-col gap-4">
      <DateField class="w-[256px]" name="date" value={value}>
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Current value: {value() ?? "(empty)"}</Description>
      </DateField>
      <div class="flex gap-2">
        <Button variant="tertiary" onPress={() => value.set(today(getLocalTimeZone()).toString())}>
          Set today
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
