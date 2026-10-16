// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/with-prefix-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Calendar } from "lucide";
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: With Icons" };

// #region demo
export function WithPrefixIcon() {
  return (
    <DateField class="w-[256px]" name="date">
      <Label>Date</Label>
      <DateField.Group>
        <DateField.Prefix>
          <Icon icon={Calendar} size={16} class="size-4 text-muted" />
        </DateField.Prefix>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
    </DateField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithPrefixIcon />
    </div>
  );
}
