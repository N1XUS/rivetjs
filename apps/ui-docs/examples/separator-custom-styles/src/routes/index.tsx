// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="max-w-xs space-y-4">
      <p class="text-sm font-medium text-foreground">Account settings</p>
      <Separator class="bg-separator-secondary" />
      <div class="flex items-center gap-3 text-sm text-muted">
        <span>Profile</span>
        <Separator class="h-4 bg-separator" orientation="vertical" />
        <span>Billing</span>
        <Separator class="h-4 bg-separator" orientation="vertical" />
        <span>Security</span>
      </div>
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
