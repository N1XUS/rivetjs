// Rivet-authored NumberValue demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Compact" };

// #region demo
export function Compact() {
  return (
    <div id="nv-compact" class="flex w-full max-w-sm flex-col gap-3 text-lg font-semibold">
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Followers</span>
        <NumberValue value={1240} notation="compact" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Downloads</span>
        <NumberValue value={3420000} notation="compact" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Market cap</span>
        <NumberValue value={7120000000} notation="compact" style="currency" currency="USD" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Long</span>
        <NumberValue value={3420000} formatOptions={{ notation: "compact", compactDisplay: "long" }} />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Compact />
    </div>
  );
}
