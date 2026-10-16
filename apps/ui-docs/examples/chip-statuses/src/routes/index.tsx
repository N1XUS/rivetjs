// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/chip/statuses.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Ban, Check, Circle, Info, TriangleAlert } from "lucide";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Chip: Statuses" };

// #region demo
export function ChipStatuses() {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Chip variant="primary">
          <Icon icon={Circle} size={6} fill="currentColor" />
          <Chip.Label>Default</Chip.Label>
        </Chip>
        <Chip color="success" variant="primary">
          <Icon icon={Circle} size={6} fill="currentColor" />
          <Chip.Label>Active</Chip.Label>
        </Chip>
        <Chip color="warning" variant="primary">
          <Icon icon={Circle} size={6} fill="currentColor" />
          <Chip.Label>Pending</Chip.Label>
        </Chip>
        <Chip color="danger" variant="primary">
          <Icon icon={Circle} size={6} fill="currentColor" />
          <Chip.Label>Inactive</Chip.Label>
        </Chip>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Chip>
          <Icon icon={Info} size={12} />
          <Chip.Label>New Feature</Chip.Label>
        </Chip>
        <Chip color="success">
          <Icon icon={Check} size={12} />
          <Chip.Label>Available</Chip.Label>
        </Chip>
        <Chip color="warning">
          <Icon icon={TriangleAlert} size={12} />
          <Chip.Label>Beta</Chip.Label>
        </Chip>
        <Chip color="danger">
          <Icon icon={Ban} size={12} />
          <Chip.Label>Deprecated</Chip.Label>
        </Chip>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ChipStatuses />
    </div>
  );
}
