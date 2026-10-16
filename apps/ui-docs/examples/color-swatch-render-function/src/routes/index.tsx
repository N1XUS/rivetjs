// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <div class="flex items-center gap-3">
      <ColorSwatch aria-label="Blue" color="#0485F7" render={(props) => <div {...props} data-custom="blue" />} />
      <ColorSwatch aria-label="Red" color="#EF4444" render={(props) => <div {...props} data-custom="red" />} />
      <ColorSwatch aria-label="Amber" color="#F59E0B" render={(props) => <div {...props} data-custom="amber" />} />
      <ColorSwatch aria-label="Green" color="#10B981" render={(props) => <div {...props} data-custom="green" />} />
      <ColorSwatch aria-label="Fuchsia" color="#D946EF" render={(props) => <div {...props} data-custom="fuchsia" />} />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
