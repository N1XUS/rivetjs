// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, Clock } from "lucide";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <TimeField fullWidth name="time">
        <Label>Time</Label>
        <TimeField.Group fullWidth>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
      </TimeField>
      <TimeField fullWidth name="time-icons">
        <Label>Time</Label>
        <TimeField.Group fullWidth>
          <TimeField.Prefix>
            <Icon icon={Clock} size={16} class="size-4 text-muted" />
          </TimeField.Prefix>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          <TimeField.Suffix>
            <Icon icon={ChevronDown} size={16} class="size-4 text-muted" />
          </TimeField.Suffix>
        </TimeField.Group>
      </TimeField>
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
