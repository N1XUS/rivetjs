// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/shapes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Shapes" };

// #region demo
export function ColorSwatchShapes() {
  return (
    <div class="flex items-center gap-3">
      <ColorSwatch color="#0485F7" shape="circle" />
      <ColorSwatch color="#0485F7" shape="square" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorSwatchShapes />
    </div>
  );
}
