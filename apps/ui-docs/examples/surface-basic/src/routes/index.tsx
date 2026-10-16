// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/surface/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "Surface: Usage" };

// #region demo
export function Basic() {
  return (
    <Surface class="flex min-w-[320px] flex-col gap-3 rounded-3xl p-6" variant="default">
      <h3 class="text-base font-semibold text-foreground">Surface Content</h3>
      <p class="text-sm text-muted">This is a default surface variant. It uses bg-surface styling.</p>
    </Surface>
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
