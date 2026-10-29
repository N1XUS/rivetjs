// Rivet-authored TrendChip demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "TrendChip: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex flex-col items-start gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <TrendChip id="trend-up" trend="up">
          12.4%
        </TrendChip>
        <TrendChip trend="down">3.1%</TrendChip>
        <TrendChip trend="neutral">0.0%</TrendChip>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
        Churn{" "}
        <TrendChip id="trend-churn" trend="down" isInverted>
          0.8%
        </TrendChip>
        p95 latency{" "}
        <TrendChip trend="up" isInverted>
          42 ms
        </TrendChip>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <TrendChip trend="up" variant="ghost">
          +$2,140
        </TrendChip>
        <TrendChip trend="up" size="sm">
          5%
        </TrendChip>
        <TrendChip trend="down" hideIcon>
          -2 seats
        </TrendChip>
      </div>
    </div>
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
