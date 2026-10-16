// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Calendar, ChevronDown } from "lucide";
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DateField: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <DateField fullWidth name="date">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
      </DateField>
      <DateField fullWidth name="date-icons">
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Prefix>
            <Icon icon={Calendar} size={16} class="size-4 text-muted" />
          </DateField.Prefix>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <Icon icon={ChevronDown} size={16} class="size-4 text-muted" />
          </DateField.Suffix>
        </DateField.Group>
      </DateField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
