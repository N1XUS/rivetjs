// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/accessibility.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Accessibility" };

// #region demo
export function ColorSwatchAccessibility() {
  return (
    <div class="flex items-center gap-3">
      <ColorSwatch aria-label="Primary brand color" color="#0485F7" colorName="Ocean Blue" />
      <ColorSwatch aria-label="Error state color" color="#EF4444" colorName="Coral Red" />
      <ColorSwatch aria-label="Warning color" color="#F59E0B" colorName="Sunset Orange" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorSwatchAccessibility />
    </div>
  );
}
