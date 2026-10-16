// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/meter/colors.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";

export const head = { title: "Meter: Colors" };

// #region demo
export function Colors() {
  return (
    <div class="flex w-64 flex-col gap-6">
      <Meter color="default" value={50}>
        <Label>Default</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="accent" value={50}>
        <Label>Accent</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="success" value={50}>
        <Label>Success</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="warning" value={50}>
        <Label>Warning</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter color="danger" value={50}>
        <Label>Danger</Label>
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
      <Colors />
    </div>
  );
}
