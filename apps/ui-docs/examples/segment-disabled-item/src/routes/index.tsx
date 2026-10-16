// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Disabled Item" };

// #region demo
export function DisabledItem() {
  return (
    <Segment aria-label="Shipping" defaultSelectedKey="standard">
      <Segment.Item id="standard">Standard</Segment.Item>
      <Segment.Item id="express">Express</Segment.Item>
      <Segment.Item id="same-day" isDisabled>
        Same day
      </Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DisabledItem />
    </div>
  );
}
