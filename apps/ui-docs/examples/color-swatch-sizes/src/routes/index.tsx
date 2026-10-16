// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Sizes" };

// #region demo
export function ColorSwatchSizes() {
  return (
    <div class="flex items-center gap-3">
      <ColorSwatch color="#0485F7" size="xs" />
      <ColorSwatch color="#EF4444" size="sm" />
      <ColorSwatch color="#F59E0B" size="md" />
      <ColorSwatch color="#10B981" size="lg" />
      <ColorSwatch color="#D946EF" size="xl" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorSwatchSizes />
    </div>
  );
}
