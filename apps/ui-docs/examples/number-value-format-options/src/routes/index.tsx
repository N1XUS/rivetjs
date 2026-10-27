// Rivet-authored NumberValue demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Format Options" };

// #region demo
export function FormatOptions() {
  return (
    <div id="nv-options" class="flex w-full max-w-sm flex-col gap-3 text-lg font-semibold">
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Significant digits</span>
        <NumberValue value={0.000123456} formatOptions={{ maximumSignificantDigits: 3 }} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Accounting</span>
        <NumberValue value={-1830} style="currency" currency="USD" formatOptions={{ currencySign: "accounting" }} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Scientific</span>
        <NumberValue value={602214076000000000000000} notation="scientific" maximumFractionDigits={3} />
      </div>
      <div class="flex items-baseline justify-between gap-6">
        <span class="text-sm text-muted">Engineering</span>
        <NumberValue value={45600} notation="engineering" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <FormatOptions />
    </div>
  );
}
