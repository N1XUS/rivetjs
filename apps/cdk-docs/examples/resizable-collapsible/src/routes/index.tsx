import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable: collapsible panel" };

// #region demo
export default function ResizableCollapsible() {
  const collapsed = signal(false);
  return (
    <div>
      <Group id="c" class="Group">
        <Panel id="sidebar" defaultSize="30%" minSize="25%" collapsible collapsedSize="8%" onResize={(size) => collapsed.set(size.asPercentage < 10)}>
          <div class="Panel">{collapsed() ? "…" : "Sidebar"}</div>
        </Panel>
        <Separator id="c-sep" class="Handle" />
        <Panel id="content">
          <div class="Panel">Content</div>
        </Panel>
      </Group>
      <p id="c-status" class="Status">
        {collapsed() ? "collapsed" : "expanded"}
      </p>
    </div>
  );
}
// #endregion
