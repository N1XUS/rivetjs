// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: Usage" };

// #region demo
export function Basic() {
  return (
    <ProgressCircle aria-label="Loading" value={60}>
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
      <Basic />
    </div>
  );
}
