// Rivet-authored NumberValue demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Currency" };

// #region demo
export function Currency() {
  return (
    <div id="nv-currency" class="flex w-full max-w-sm flex-col gap-3 text-lg font-semibold">
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">USD</span>
        <NumberValue value={2499.99} style="currency" currency="USD" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">EUR (de-DE)</span>
        <NumberValue value={2499.99} style="currency" currency="EUR" locale="de-DE" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">JPY (ja-JP)</span>
        <NumberValue value={2499.99} style="currency" currency="JPY" locale="ja-JP" />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">GBP, no decimals</span>
        <NumberValue value={2499.99} style="currency" currency="GBP" maximumFractionDigits={0} />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Currency />
    </div>
  );
}
