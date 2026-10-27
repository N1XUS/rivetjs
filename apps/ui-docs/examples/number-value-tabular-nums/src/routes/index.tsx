// Rivet-authored NumberValue demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "NumberValue: Tabular Nums" };

// #region demo
const PRICES = [1111.11, 98.08, 4720.5, 10.01];

export function TabularNums() {
  return (
    <div id="nv-tabular" class="grid grid-cols-2 gap-x-10 gap-y-2 text-lg">
      <span class="text-sm text-muted">Proportional</span>
      <span class="text-sm text-muted">Tabular</span>
      {PRICES.map((price) => (
        <>
          <span class="text-end">
            <NumberValue value={price} style="currency" currency="USD" />
          </span>
          <span class="text-end">
            <NumberValue value={price} style="currency" currency="USD" isTabular />
          </span>
        </>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <TabularNums />
    </div>
  );
}
