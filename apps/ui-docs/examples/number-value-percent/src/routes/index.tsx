// Rivet-authored NumberValue demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Percent" };

// #region demo
export function Percent() {
  return (
    <div id="nv-percent" class="flex w-full max-w-sm flex-col gap-3 text-lg font-semibold">
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Conversion</span>
        <NumberValue value={0.0342} style="percent" maximumFractionDigits={2} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Uptime</span>
        <NumberValue value={0.99987} style="percent" minimumFractionDigits={2} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Growth</span>
        <NumberValue value={1.25} style="percent" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Percent />
    </div>
  );
}
