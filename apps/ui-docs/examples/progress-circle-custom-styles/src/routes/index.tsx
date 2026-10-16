// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-circle/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "ProgressCircle: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ProgressCircle aria-label="Sync progress" class="size-14 text-neutral-700 dark:text-neutral-300" value={68}>
      <ProgressCircle.Track>
        <ProgressCircle.TrackCircle class="stroke-neutral-200 dark:stroke-neutral-800" />
        <ProgressCircle.FillCircle class="stroke-neutral-700 dark:stroke-neutral-300" stroke-linecap="round" />
      </ProgressCircle.Track>
    </ProgressCircle>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
