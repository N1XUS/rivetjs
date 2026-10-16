// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/transparency.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Transparency" };

// #region demo
export function ColorSwatchTransparency() {
  return (
    <div class="flex items-center gap-3">
      <ColorSwatch aria-label="100% opacity" color="rgba(4, 133, 247, 1)" />
      <ColorSwatch aria-label="75% opacity" color="rgba(4, 133, 247, 0.75)" />
      <ColorSwatch aria-label="50% opacity" color="rgba(4, 133, 247, 0.5)" />
      <ColorSwatch aria-label="25% opacity" color="rgba(4, 133, 247, 0.25)" />
      <ColorSwatch aria-label="0% opacity" color="rgba(4, 133, 247, 0)" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorSwatchTransparency />
    </div>
  );
}
