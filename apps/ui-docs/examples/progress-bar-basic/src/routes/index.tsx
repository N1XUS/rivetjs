// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";

export const head = { title: "ProgressBar: Usage" };

// #region demo
export function Basic() {
  return (
    <ProgressBar aria-label="Loading" class="w-64" value={60}>
      <Label>Loading</Label>
      <ProgressBar.Output />
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
      <Basic />
    </div>
  );
}
