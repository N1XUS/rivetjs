import { Group, Panel, Separator, useGroupRef, usePanelRef } from "@rivetjs/cdk/resizable";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable: imperative API" };

// #region demo
export default function ResizableImperative() {
  const group = useGroupRef();
  const left = usePanelRef();
  const layout = signal("");
  return (
    <div>
      <div class="Toolbar">
        <button id="imp-collapse" type="button" onClick={() => left.current?.collapse()}>
          Collapse
        </button>
        <button id="imp-expand" type="button" onClick={() => left.current?.expand()}>
          Expand
        </button>
        <button id="imp-resize" type="button" onClick={() => left.current?.resize("60%")}>
          Resize to 60%
        </button>
        <button id="imp-reset" type="button" onClick={() => group.current?.setLayout({ "imp-left": 50, "imp-right": 50 })}>
          50 / 50
        </button>
        <button id="imp-read" type="button" onClick={() => layout.set(JSON.stringify(group.current?.getLayout()))}>
          Read layout
        </button>
      </div>
      <Group id="imp" class="Group" groupRef={group}>
        <Panel id="imp-left" panelRef={left} defaultSize="30%" minSize="20%" collapsible collapsedSize="5%">
          <div class="Panel">Left</div>
        </Panel>
        <Separator id="imp-sep" class="Handle" />
        <Panel id="imp-right">
          <div class="Panel">Right</div>
        </Panel>
      </Group>
      <p id="imp-status" class="Status">
        {layout()}
      </p>
    </div>
  );
}
// #endregion
