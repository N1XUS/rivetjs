// Rivet-authored TrendChip demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "TrendChip: prefix and suffix" };

// #region demo
export function PrefixSuffix() {
  return (
    <div id="tc-affix" class="flex flex-col items-start gap-3">
      <TrendChip trend="up">
        <TrendChip.Prefix>+</TrendChip.Prefix>
        $1,240
        <TrendChip.Suffix>this month</TrendChip.Suffix>
      </TrendChip>
      <TrendChip trend="down" isInverted>
        -18 ms
        <TrendChip.Suffix>p95 latency</TrendChip.Suffix>
      </TrendChip>
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
