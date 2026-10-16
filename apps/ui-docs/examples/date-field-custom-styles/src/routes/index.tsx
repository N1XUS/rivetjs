// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <DateField class="w-64" name="due-date">
      <Label>Due date</Label>
      <DateField.Group class="rounded-xl border border-border/80 bg-default shadow-sm" variant="secondary">
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
    </DateField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
