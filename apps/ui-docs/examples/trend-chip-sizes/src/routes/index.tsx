// Rivet-authored TrendChip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "TrendChip: sizes" };

// #region demo
export function Sizes() {
  return (
    <div id="tc-sizes" class="flex items-center gap-3">
      <TrendChip trend="up" size="sm">
        4.2%
      </TrendChip>
      <TrendChip trend="up" size="md">
        4.2%
      </TrendChip>
      <TrendChip trend="up" size="lg">
        4.2%
      </TrendChip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}
