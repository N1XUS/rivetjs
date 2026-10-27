// Rivet-authored Status demo (Rivet addition, own demo content).
import { Status } from "@rivetjs/ui/status";

export const head = { title: "Status: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div id="status-sizes" class="flex items-center gap-6 text-sm">
      <span class="flex items-center gap-2">
        <Status color="accent" size="sm" /> Small
      </span>
      <span class="flex items-center gap-2">
        <Status color="accent" size="md" /> Medium
      </span>
      <span class="flex items-center gap-2">
        <Status color="accent" size="lg" /> Large
      </span>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
