// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Usage" };

// #region demo
export function Basic() {
  return (
    <Segment aria-label="Calendar range" defaultSelectedKey="week">
      <Segment.Item id="day">Day</Segment.Item>
      <Segment.Item id="week">Week</Segment.Item>
      <Segment.Item id="month">Month</Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
