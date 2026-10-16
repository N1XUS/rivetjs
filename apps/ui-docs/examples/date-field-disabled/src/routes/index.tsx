// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Disabled State" };

// #region demo
import { getLocalTimeZone, today } from "@rivetjs/cdk/date";

export function Disabled() {
  return (
    <div class="flex flex-col gap-4">
      <DateField isDisabled class="w-[256px]" name="date" value={today(getLocalTimeZone())}>
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>This date field is disabled</Description>
      </DateField>
      <DateField isDisabled class="w-[256px]" name="date-empty">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>This date field is disabled</Description>
      </DateField>
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
