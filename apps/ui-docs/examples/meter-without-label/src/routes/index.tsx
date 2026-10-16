// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/without-label.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Without Label" };

// #region demo
export function WithoutLabel() {
  return (
    <Meter aria-label="Storage usage" class="w-64" value={45}>
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
      <WithoutLabel />
    </div>
  );
}
