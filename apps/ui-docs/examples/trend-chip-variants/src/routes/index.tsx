// Rivet-authored TrendChip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "TrendChip: variants" };

// #region demo
const VARIANTS = ["soft", "primary", "secondary", "tertiary", "ghost"] as const;

export function Variants() {
  return (
    <div id="tc-variants" class="grid grid-cols-3 gap-3">
      {VARIANTS.map((variant) => (
        <>
          <TrendChip trend="up" variant={variant}>
            12%
          </TrendChip>
          <TrendChip trend="down" variant={variant}>
            3.1%
          </TrendChip>
          <TrendChip variant={variant}>0%</TrendChip>
        </>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Variants />
    </div>
  );
}
