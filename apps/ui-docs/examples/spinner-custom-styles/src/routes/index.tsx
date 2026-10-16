// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/spinner/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Spinner: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4">
      <Spinner class="text-accent" size="sm" />
      <Spinner class="text-muted" size="md" />
      <Spinner class="text-success" size="lg" />
    </div>
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
