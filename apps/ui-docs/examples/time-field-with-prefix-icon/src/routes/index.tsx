// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/with-prefix-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Clock } from "lucide";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: With Icons" };

// #region demo
export function WithPrefixIcon() {
  return (
    <TimeField class="w-[256px]" name="time">
      <Label>Time</Label>
      <TimeField.Group>
        <TimeField.Prefix>
          <Icon icon={Clock} size={16} class="size-4 text-muted" />
        </TimeField.Prefix>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      </TimeField.Group>
    </TimeField>
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
