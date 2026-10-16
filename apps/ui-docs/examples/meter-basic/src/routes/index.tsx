// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Usage" };

// #region demo
export function Basic() {
  return (
    <Meter aria-label="Storage" class="w-64" value={60}>
      <Label>Storage</Label>
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
      <Basic />
    </div>
  );
}
