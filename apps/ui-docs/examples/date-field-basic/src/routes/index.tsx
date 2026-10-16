// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Usage" };

// #region demo
export function Basic() {
  return (
    <DateField class="w-[256px]" name="date">
      <Label>Date</Label>
      <DateField.Group>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
    </DateField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
