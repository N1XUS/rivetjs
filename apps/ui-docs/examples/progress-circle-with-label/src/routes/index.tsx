// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/with-label.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: With Label" };

// #region demo
export function WithLabel() {
  return (
    <div class="flex items-center gap-3">
      <ProgressCircle aria-label="Loading" value={75}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      <Label>75% Complete</Label>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithLabel />
    </div>
  );
}
