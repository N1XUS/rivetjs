// Rivet-authored Segment demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: With Separators" };

// #region demo
export function WithSeparators() {
  return (
    <Segment aria-label="Plan length" defaultSelectedKey="quarterly">
      <Segment.Item id="monthly">Monthly</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="quarterly">Quarterly</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="yearly">Yearly</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="lifetime">Lifetime</Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSeparators />
    </div>
  );
}
