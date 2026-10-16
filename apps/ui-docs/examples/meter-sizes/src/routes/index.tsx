// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex w-64 flex-col gap-6">
      <Meter color="success" size="sm" value={40}>
        <Label>Small</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="accent" size="md" value={60}>
        <Label>Medium</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="warning" size="lg" value={80}>
        <Label>Large</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
