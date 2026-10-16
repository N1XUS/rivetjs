import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";

export const head = { title: "Resizable: nested groups" };

// #region demo
export default function ResizableNested() {
  return (
    <Group id="outer" class="Group">
      <Panel id="side" defaultSize="30%">
        <div class="Panel">Side</div>
      </Panel>
      <Separator id="outer-sep" class="Handle" />
      <Panel id="main">
        <Group id="inner" orientation="vertical">
          <Panel id="editor" defaultSize="60%">
            <div class="Panel">Editor</div>
          </Panel>
          <Separator id="inner-sep" class="Handle" />
          <Panel id="console">
            <div class="Panel">Console</div>
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}
// #endregion
