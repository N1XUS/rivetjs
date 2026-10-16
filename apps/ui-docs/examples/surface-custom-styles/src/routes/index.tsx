// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/surface/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "Surface: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Surface class="w-full max-w-sm rounded-xl border border-accent/15 bg-linear-to-br from-accent/8 via-surface to-surface-secondary p-4" variant="default">
      <h3 class="text-sm font-semibold text-foreground">Billing overview</h3>
      <p class="text-sm text-muted">View invoices and payment methods in one place.</p>
    </Surface>
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
