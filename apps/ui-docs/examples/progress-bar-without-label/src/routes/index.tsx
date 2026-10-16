// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/without-label.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressBar } from "@rivetjs/ui/progress-bar";

export const head = { title: "ProgressBar: Without Label" };

// #region demo
export function WithoutLabel() {
  return (
    <ProgressBar aria-label="Loading progress" class="w-64" value={45}>
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
      <WithoutLabel />
    </div>
  );
}
