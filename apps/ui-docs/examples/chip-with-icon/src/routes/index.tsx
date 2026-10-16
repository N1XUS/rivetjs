// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/chip/with-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, CircleCheck, Circle, Clock, X } from "lucide";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Chip: With Icons" };

// #region demo
export function ChipWithIcon() {
  return (
    <div class="flex flex-wrap items-center gap-3">
      <Chip>
        <Icon icon={Circle} size={6} fill="currentColor" />
        <Chip.Label>Information</Chip.Label>
      </Chip>
      <Chip color="success">
        <Icon icon={CircleCheck} size={12} fill="currentColor" />
        <Chip.Label>Completed</Chip.Label>
      </Chip>
      <Chip color="warning">
        <Icon icon={Clock} size={12} />
        <Chip.Label>Pending</Chip.Label>
      </Chip>
      <Chip color="danger">
        <Icon icon={X} size={12} />
        <Chip.Label>Failed</Chip.Label>
      </Chip>
      <Chip color="accent">
        <Chip.Label>Label</Chip.Label>
        <Icon icon={ChevronDown} size={12} />
      </Chip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ChipWithIcon />
    </div>
  );
}
