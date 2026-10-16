// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/colors.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: Colors" };

// #region demo
export function Colors() {
  return (
    <div class="flex items-center gap-6">
      <ProgressCircle aria-label="Default" color="default" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      <ProgressCircle aria-label="Accent" color="accent" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      <ProgressCircle aria-label="Success" color="success" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      <ProgressCircle aria-label="Warning" color="warning" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      <ProgressCircle aria-label="Danger" color="danger" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}
