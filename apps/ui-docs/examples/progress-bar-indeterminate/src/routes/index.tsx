// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/indeterminate.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";

export const head = { title: "ProgressBar: Indeterminate" };

// #region demo
export function Indeterminate() {
  return (
    <ProgressBar isIndeterminate aria-label="Loading" class="w-64">
      <Label>Loading...</Label>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indeterminate />
    </div>
  );
}
