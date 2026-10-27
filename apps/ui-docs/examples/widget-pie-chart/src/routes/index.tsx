// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { DonutChart } from "@rivetjs/ui/chart";

export const head = { title: "Widget: With Pie Chart" };

// #region demo
export function WithPieChart() {
  return (
    <Widget id="widget-pie" class="w-full max-w-sm">
      <Widget.Header>
        <div class="flex flex-col">
          <Widget.Title>Traffic sources</Widget.Title>
          <Widget.Description>This month</Widget.Description>
        </div>
      </Widget.Header>
      <Widget.Content class="flex justify-center">
        <DonutChart
          data={[
            { key: "organic", label: "Organic", value: 4820 },
            { key: "direct", label: "Direct", value: 3110 },
            { key: "referral", label: "Referral", value: 1640 },
          ]}
          centerLabel="Visits"
          aria-label="Visits by source"
        />
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithPieChart />
    </div>
  );
}
