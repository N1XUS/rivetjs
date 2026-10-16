// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Required Field" };

// #region demo
export function Required() {
  return (
    <div class="flex flex-col gap-4">
      <DateField isRequired class="w-[256px]" name="date">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
      </DateField>
      <DateField isRequired class="w-[256px]" name="start-date">
        <Label>Start date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Required field</Description>
      </DateField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
