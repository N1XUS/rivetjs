import { Group, Panel, Separator, useDefaultLayout } from "@rivetjs/cdk/resizable";

export const head = { title: "Resizable: persisted layout" };

// #region demo
export default function ResizablePersistence() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "docs-persisted" });
  return (
    <Group id="docs-persisted" class="Group" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <Panel id="list" defaultSize="35%">
        <div class="Panel">List</div>
      </Panel>
      <Separator id="p-sep" class="Handle" />
      <Panel id="detail">
        <div class="Panel">Detail (resize, then reload)</div>
      </Panel>
    </Group>
  );
}
// #endregion
