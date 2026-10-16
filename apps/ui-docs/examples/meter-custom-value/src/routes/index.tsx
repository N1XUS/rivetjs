// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/custom-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Custom Value Scale" };

// #region demo
export function CustomValue() {
  return (
    <Meter class="w-64" formatOptions={{ currency: "USD", style: "currency" }} maxValue={1000} minValue={0} value={750}>
      <Label>Revenue</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValue />
    </div>
  );
}
