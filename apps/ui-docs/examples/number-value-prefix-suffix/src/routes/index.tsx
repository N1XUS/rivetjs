// Rivet-authored NumberValue demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: With Prefix Suffix" };

// #region demo
export function PrefixSuffix() {
  return (
    <div id="nv-affix" class="flex w-full max-w-sm flex-col gap-3 text-2xl font-semibold">
      <NumberValue value={29} style="currency" currency="USD" maximumFractionDigits={0} suffix="/month" />
      <NumberValue value={1200} notation="compact" prefix="~" suffix="visitors" />
      <NumberValue value={4.8} minimumFractionDigits={1}>
        <NumberValue.Value />
        <NumberValue.Suffix>/ 5 rating</NumberValue.Suffix>
      </NumberValue>
      <NumberValue value={0.12} style="percent">
        {(formatted) => <span class="text-success">{formatted} faster</span>}
      </NumberValue>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <PrefixSuffix />
    </div>
  );
}
