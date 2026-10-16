import { signal } from "@rivetjs/reactivity";
import { Meter } from "@rivetjs/cdk/meter";
import { Label } from "@rivetjs/cdk/label";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Meter value scale and formatting" };

// #region demo
export default function MeterFormats() {
  const used = signal(512);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      {/* A unit: the raw value is formatted (not the percentage). Accessor value: only the bindings update. */}
      <Meter id="disk" value={() => used()} maxValue={1024} formatOptions={{ style: "unit", unit: "megabyte" }}>
        {({ percentage, valueText }) => (
          <>
            <Label>Disk</Label> <span id="disk-text">{valueText()}</span>
            <div class="h-2 rounded bg-slate-200">
              <div id="disk-fill" class="h-full rounded bg-indigo-600" style={{ width: percentage() + "%" }} />
            </div>
          </>
        )}
      </Meter>
      <Button id="more" class="w-fit rounded border px-2 py-1" onPress={() => used.set(Math.min(1024, used() + 256))}>
        Use 256 MB more
      </Button>
      {/* Custom range and currency. */}
      <Meter id="budget" value={300} minValue={0} maxValue={1200} formatOptions={{ style: "currency", currency: "EUR" }} aria-label="Budget spent">
        {({ valueText }) => <span id="budget-text">{valueText()} spent</span>}
      </Meter>
      {/* valueLabel: your own text, used as aria-valuetext too. */}
      <Meter id="steps" value={3} maxValue={4} valueLabel="3 of 4 steps" aria-label="Setup">
        {({ valueText }) => <span id="steps-text">{valueText()}</span>}
      </Meter>
    </div>
  );
}
// #endregion
