// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="flex flex-col gap-4">
      <DateField class="w-[256px]" name="date">
        <Label>Birth date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Enter your date of birth</Description>
      </DateField>
      <DateField class="w-[256px]" name="appointment-date">
        <Label>Appointment date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Enter a date for your appointment</Description>
      </DateField>
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
