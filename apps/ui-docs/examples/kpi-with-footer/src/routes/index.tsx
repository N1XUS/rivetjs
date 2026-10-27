// Rivet-authored Kpi demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Kpi } from "@rivetjs/ui/kpi";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Kpi: with footer" };

// #region demo
export function WithFooter() {
  return (
    <Kpi id="kpi-footer" class="w-full max-w-72">
      <Kpi.Header>
        <Kpi.Title>Conversion rate</Kpi.Title>
      </Kpi.Header>
      <Kpi.Content>
        <Kpi.Value value={0.0348} formatOptions={{ style: "percent", maximumFractionDigits: 2 }} />
        <Kpi.Trend trend="down">0.4%</Kpi.Trend>
      </Kpi.Content>
      <Kpi.Separator />
      <Kpi.Footer class="mt-0 border-t-0 pt-0">
        <Link href="#report">View report</Link>
      </Kpi.Footer>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithFooter />
    </div>
  );
}
