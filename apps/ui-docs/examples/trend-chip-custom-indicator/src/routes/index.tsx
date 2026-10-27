// Rivet-authored TrendChip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowDownRight, ArrowUpRight } from "lucide";

export const head = { title: "TrendChip: custom indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <div id="tc-indicator" class="flex items-center gap-3">
      <TrendChip trend="up">
        <TrendChip.Indicator>
          <Icon icon={ArrowUpRight} size={14} />
        </TrendChip.Indicator>
        8.4%
      </TrendChip>
      <TrendChip trend="down">
        <TrendChip.Indicator>
          <Icon icon={ArrowDownRight} size={14} />
        </TrendChip.Indicator>
        2.6%
      </TrendChip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomIndicator />
    </div>
  );
}
