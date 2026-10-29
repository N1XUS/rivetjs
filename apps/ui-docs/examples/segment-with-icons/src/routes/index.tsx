// Rivet-authored Segment demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Segment } from "@rivetjs/ui/segment";
import { Columns3, LayoutGrid, List } from "lucide";

export const head = { title: "Segment: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <Segment aria-label="Layout" defaultSelectedKey="grid">
      <Segment.Item id="list">
        <Icon icon={List} />
        List
      </Segment.Item>
      <Segment.Item id="grid">
        <Icon icon={LayoutGrid} />
        Grid
      </Segment.Item>
      <Segment.Item id="board">
        <Icon icon={Columns3} />
        Board
      </Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}
