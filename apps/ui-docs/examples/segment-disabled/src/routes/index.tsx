// Rivet-authored Segment demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Disabled" };

// #region demo
export function Disabled() {
  return (
    <Segment aria-label="Quality" defaultSelectedKey="hd" isDisabled>
      <Segment.Item id="sd">SD</Segment.Item>
      <Segment.Item id="hd">HD</Segment.Item>
      <Segment.Item id="4k">4K</Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
