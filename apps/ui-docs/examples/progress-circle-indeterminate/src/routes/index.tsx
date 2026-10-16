// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/indeterminate.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: Indeterminate" };

// #region demo
export function Indeterminate() {
  return (
    <ProgressCircle isIndeterminate aria-label="Loading">
      <ProgressCircle.Track>
        <ProgressCircle.TrackCircle />
        <ProgressCircle.FillCircle />
      </ProgressCircle.Track>
    </ProgressCircle>
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
