// Rivet-authored NumberValue demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Sign Display" };

// #region demo
export function SignDisplay() {
  return (
    <div id="nv-sign" class="flex w-full max-w-sm flex-col gap-3 text-lg font-semibold">
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">always</span>
        <NumberValue value={0.125} signDisplay="always" style="percent" formatOptions={{ maximumFractionDigits: 1 }} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">exceptZero (0)</span>
        <NumberValue value={0} signDisplay="exceptZero" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">exceptZero (−4)</span>
        <NumberValue value={-4} signDisplay="exceptZero" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">never</span>
        <NumberValue value={-320} signDisplay="never" style="currency" currency="USD" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <SignDisplay />
    </div>
  );
}
