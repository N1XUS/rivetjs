// Story: Angular CDK drag-drop components on a resumed page (drag-drop-resume.test.ts). Everything sits
// below a tall spacer so nothing drag-drop related loads before it scrolls into view (`preload = "visible"`).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DragHandle, DragPlaceholder, DragPreview, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export default function DragDropStory() {
  const items = signal(["Zero", "One", "Two", "Three"]);
  const drops = signal(0);
  const last = signal("");
  const position = signal({ x: 20, y: 10 });
  return (
    <section>
      <h1>Drag and drop</h1>
      <p>
        drops: <span id="drops">{drops()}</span> last: <span id="last">{last()}</span> order: <span id="order">{items().join(",")}</span>
      </p>
      <p id="plain">
        <For each={items} by={(item) => item}>
          {(item) => <span>{item()}</span>}
        </For>
      </p>
      <div id="spacer" style={{ height: "2000px" }} />
      <DropList
        id="list"
        style={{ width: "200px" }}
        onDropped={(event) => {
          const next = items().slice();
          moveItemInArray(next, event.previousIndex, event.currentIndex);
          items.set(next);
          last.set(event.previousIndex + ">" + event.currentIndex);
          drops.set(drops() + 1);
        }}
      >
        <For each={items} by={(item) => item}>
          {(item) => (
            <Drag id={"item-" + item()} style={{ height: "30px", background: "#ddd", "box-sizing": "border-box", border: "1px solid #999" }}>
              {item()}
            </Drag>
          )}
        </For>
      </DropList>
      <Drag id="free" freeDragPosition={position} style={{ width: "80px", height: "40px", background: "#cce" }}>
        free
        <DragPreview matchSize>
          <div id="free-preview">preview</div>
        </DragPreview>
        <DragPlaceholder>
          <div id="free-placeholder">placeholder</div>
        </DragPlaceholder>
      </Drag>
      <Drag id="handled" style={{ width: "120px", height: "40px", background: "#cec" }}>
        <DragHandle id="handle" style={{ width: "20px", height: "20px", background: "#393" }} />
        body
      </Drag>
    </section>
  );
}
