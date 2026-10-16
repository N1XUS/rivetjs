// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <DateField class="w-[256px]" name="date" render={(props) => <div {...props} data-custom="date-field" />}>
      <Label render={(props) => <span {...(props as object)} data-custom="date-field-label" />}>Date</Label>
      <DateField.Group render={(props) => <div {...props} data-custom="date-field-group" />}>
        <DateField.Input render={(props) => <div {...props} data-custom="date-field-input" />}>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
      </DateField.Group>
    </DateField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
