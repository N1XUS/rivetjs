import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable: horizontal" };

// #region demo
export default function ResizableHorizontal() {
  const layout = signal("");
  return (
    <div>
      <Group
        id="h"
        class="Group"
        onLayoutChange={(next) =>
          layout.set(
            Object.values(next)
              .map((size) => Math.round(size))
              .join(" / "),
          )
        }
      >
        <Panel id="left" defaultSize="40%" minSize="20%">
          <div class="Panel">Left</div>
        </Panel>
        <Separator id="h-sep" class="Handle" aria-label="Resize left panel" />
        <Panel id="right" minSize="20%">
          <div class="Panel">Right</div>
        </Panel>
      </Group>
      <p id="h-status" class="Status">
        {layout()}
      </p>
    </div>
  );
}
// #endregion
