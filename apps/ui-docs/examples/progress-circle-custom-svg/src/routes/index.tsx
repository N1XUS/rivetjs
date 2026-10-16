// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/custom-svg.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: Custom SVG Props" };

// #region demo
export function CustomSvg() {
  return (
    <div class="flex items-end gap-6">
      <ProgressCircle aria-label="Thin circle" value={60}>
        <ProgressCircle.Track stroke-width={2} viewBox="0 0 36 36">
          <ProgressCircle.TrackCircle cx={18} cy={18} r={17} stroke-width={2} />
          <ProgressCircle.FillCircle cx={18} cy={18} r={17} stroke-width={2} />
        </ProgressCircle.Track>
      </ProgressCircle>

      <ProgressCircle aria-label="Default circle" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>

      <ProgressCircle aria-label="Thick circle" value={60}>
        <ProgressCircle.Track stroke-width={6} viewBox="0 0 36 36">
          <ProgressCircle.TrackCircle cx={18} cy={18} r={15} stroke-width={6} />
          <ProgressCircle.FillCircle cx={18} cy={18} r={15} stroke-width={6} />
        </ProgressCircle.Track>
      </ProgressCircle>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomSvg />
    </div>
  );
}
