// Rivet-authored Status demo (Rivet addition, own demo content).
import { Status } from "@rivetjs/ui/status";

export const head = { title: "Status: Pulse" };

// #region demo
export function Pulse() {
  return (
    <div class="flex flex-col gap-4 text-sm">
      <p id="deploy-status" class="flex items-center gap-3">
        <Status color="warning" size="lg" pulse aria-label="Deploying" />
        Production
      </p>
      <p class="flex items-center gap-3">
        <Status color="danger" pulse />
        Recording
      </p>
      <p class="flex items-center gap-3">
        <Status color="success" size="sm" pulse />
        Live
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Pulse />
    </div>
  );
}
