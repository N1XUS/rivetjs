import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";

export const head = { title: "Resizable: vertical" };

// #region demo
export default function ResizableVertical() {
  return (
    <Group id="v" class="Group" orientation="vertical">
      <Panel id="top" defaultSize="30%">
        <div class="Panel">Top</div>
      </Panel>
      <Separator id="v-sep" class="Handle" />
      <Panel id="bottom">
        <div class="Panel">Bottom</div>
      </Panel>
    </Group>
  );
}
// #endregion
