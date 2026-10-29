// Rivet-authored Status demo (Rivet addition, own demo content).
import { Avatar } from "@rivetjs/ui/avatar";
import { Chip } from "@rivetjs/ui/chip";
import { Status } from "@rivetjs/ui/status";

export const head = { title: "Status: Placement" };

// #region demo
export function Placement() {
  return (
    <div class="flex items-center gap-8">
      <span id="presence-ada" class="relative inline-flex">
        <Avatar>
          <Avatar.Fallback>AO</Avatar.Fallback>
        </Avatar>
        <Status color="success" aria-label="Online" class="absolute end-0 bottom-0 ring-2 ring-background" />
      </span>
      <span id="presence-lukas" class="relative inline-flex">
        <Avatar>
          <Avatar.Fallback>LB</Avatar.Fallback>
        </Avatar>
        <Status aria-label="Away" class="absolute end-0 bottom-0 ring-2 ring-background" />
      </span>
      <Chip id="order-chip" size="sm" variant="soft" color="warning">
        <Status color="warning" size="sm" pulse />
        Pending
      </Chip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placement />
    </div>
  );
}
