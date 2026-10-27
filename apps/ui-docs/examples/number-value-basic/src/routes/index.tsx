// Rivet-authored NumberValue demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Usage" };

// #region demo
export function Basic() {
  return (
    <p id="nv-basic" class="text-3xl font-semibold">
      <NumberValue value={1284903.5} style="currency" currency="USD" />
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
