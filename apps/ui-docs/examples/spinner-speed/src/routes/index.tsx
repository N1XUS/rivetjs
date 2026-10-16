// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/spinner/speed.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Spinner: Speed" };

// #region demo
export function SpinnerSpeed() {
  return (
    <div class="flex items-center gap-8">
      <div class="flex flex-col items-center gap-2">
        <Spinner class="animate-[spin_1.5s_linear_infinite] motion-reduce:animate-none" />
        <span class="text-xs text-muted">Slow</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner />
        <span class="text-xs text-muted">Default</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner class="animate-[spin_0.4s_linear_infinite] motion-reduce:animate-none" />
        <span class="text-xs text-muted">Fast</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SpinnerSpeed />
    </div>
  );
}
