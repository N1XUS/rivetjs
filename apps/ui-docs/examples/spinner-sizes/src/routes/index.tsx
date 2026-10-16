// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/spinner/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Spinner: Sizes" };

// #region demo
export function SpinnerSizes() {
  return (
    <div class="flex items-center gap-8">
      <div class="flex flex-col items-center gap-2">
        <Spinner size="sm" />
        <span class="text-xs text-muted">Small</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner size="md" />
        <span class="text-xs text-muted">Medium</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <span class="text-xs text-muted">Large</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner size="xl" />
        <span class="text-xs text-muted">Extra Large</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SpinnerSizes />
    </div>
  );
}
