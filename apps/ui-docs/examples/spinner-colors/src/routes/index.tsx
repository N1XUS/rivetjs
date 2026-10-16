// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/spinner/colors.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Spinner: Colors" };

// #region demo
export function SpinnerColors() {
  return (
    <div class="flex items-center gap-8">
      <div class="flex flex-col items-center gap-2">
        <Spinner color="current" />
        <span class="text-xs text-muted">Current</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner color="accent" />
        <span class="text-xs text-muted">Accent</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner color="success" />
        <span class="text-xs text-muted">Success</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner color="warning" />
        <span class="text-xs text-muted">Warning</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Spinner color="danger" />
        <span class="text-xs text-muted">Danger</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SpinnerColors />
    </div>
  );
}
