import { Meter } from "@rivetjs/cdk/meter";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "Meter with a label and a fill" };

// #region demo
export default function StorageMeter() {
  return (
    <Meter id="storage" value={72} class="m-4 grid w-64 grid-cols-[1fr_auto] gap-1 text-sm">
      {({ percentage, valueText }) => (
        <>
          <Label>Storage space</Label>
          <span id="storage-value" class="text-slate-600">
            {valueText()}
          </span>
          <div class="col-span-2 h-2 overflow-hidden rounded bg-slate-200">
            <div id="storage-fill" class="h-full bg-teal-600" style={{ width: percentage() + "%" }} />
          </div>
        </>
      )}
    </Meter>
  );
}
// #endregion
