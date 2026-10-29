// Rivet-authored Chart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { DonutChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Donut" };

// #region demo
export function Donut() {
  return (
    <DonutChart
      id="chart-donut"
      data={[
        { key: "organic", label: "Organic search", value: 4820 },
        { key: "direct", label: "Direct", value: 3110 },
        { key: "email", label: "Newsletter", value: 1640 },
        { key: "social", label: "Social", value: 930 },
      ]}
      centerLabel="Sessions"
      aria-label="Sessions by channel"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Donut />
    </div>
  );
}
