// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <DateField class="w-[256px]" name="primary-date">
        <Label>Primary variant</Label>
        <DateField.Group variant="primary">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
      </DateField>
      <DateField class="w-[256px]" name="secondary-date">
        <Label>Secondary variant</Label>
        <DateField.Group variant="secondary">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
      </DateField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
