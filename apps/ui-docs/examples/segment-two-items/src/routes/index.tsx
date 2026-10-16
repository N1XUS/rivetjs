// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Two Items" };

// #region demo
export function TwoItems() {
  return (
    <Segment aria-label="Billing" defaultSelectedKey="annual">
      <Segment.Item id="monthly">Pay monthly</Segment.Item>
      <Segment.Item id="annual">Pay annually</Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TwoItems />
    </div>
  );
}
