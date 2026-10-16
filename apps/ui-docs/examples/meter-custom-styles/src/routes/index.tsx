// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Meter aria-label="Storage used" class="w-64" value={68}>
      <Label class="font-medium text-foreground">Storage used</Label>
      <Meter.Output class="text-muted tabular-nums" />
      <Meter.Track class="rounded-full bg-default">
        <Meter.Fill class="rounded-full bg-warning" />
      </Meter.Track>
    </Meter>
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
