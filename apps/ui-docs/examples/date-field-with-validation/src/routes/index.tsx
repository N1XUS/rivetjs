// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: With Validation" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";

export function WithValidation() {
  // Rivet: a controlled value is a two-way signal of the date string; ISO date strings compare like the dates.
  const value = signal<string | null>(null);
  const todayDate = today(getLocalTimeZone()).toString();
  const isInvalid = () => value() !== null && value()! < todayDate;

  return (
    <div class="flex flex-col gap-4">
      <DateField isRequired class="w-[256px]" isInvalid={isInvalid} minValue={todayDate} name="date" value={value}>
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        {isInvalid() ? <FieldError>Date must be today or in the future</FieldError> : <Description>Enter a date from today onwards</Description>}
      </DateField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithValidation />
    </div>
  );
}
