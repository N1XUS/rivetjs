// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-swatch/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSwatch } from "@rivetjs/ui/color-swatch";

export const head = { title: "ColorSwatch: Tailwind CSS" };

// #region demo
export function ColorSwatchCustomStyles() {
  const colors = ["#0485F7", "#EF4444", "#F59E0B", "#10B981", "#D946EF"];

  return (
    <div class="flex flex-col gap-8">
      {/* Glow effect */}
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Glow Effect</span>
        <div class="flex items-center gap-4">
          {colors.map((color) => (
            <ColorSwatch
              color={color}
              size="xl"
              style={() => ({
                boxShadow: `0 0 20px 2px ${color}`,
              })}
            />
          ))}
        </div>
      </div>

      {/* Gradient swatch */}
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Gradient</span>
        <div class="flex items-center gap-4">
          {colors.map((color) => (
            <ColorSwatch
              color={color}
              size="xl"
              style={({ color: c }) => ({
                background: `linear-gradient(135deg, ${c().toString("css")}, white)`,
              })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorSwatchCustomStyles />
    </div>
  );
}
