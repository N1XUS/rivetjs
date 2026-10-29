// DOM-target suite: ListView (Rivet addition): row press selects (single / multiple) through `onSelectionChange`, `onAction`
// fires without selection, disabled rows ignore presses (keyboard / resume / virtualization: story `/list-view`); a row
// wrapper given eager JSX holding ui components renders it (TITLE-JSX: built in the GridList's collection build pass).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { ListView } = await import("../src/components/list-view/index.ts");
const { Chip } = await import("../src/components/chip/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

test("list view: multiple selection, disabled row ignored", async () => {
  let selected: string[] = [];
  const { container, unmount } = render(() => (
    <ListView
      aria-label="People"
      selectionMode="multiple"
      disabledKeys={["c"]}
      onSelectionChange={(k) => (selected = k === "all" ? ["all"] : [...k].map(String))}
    >
      <ListView.Item id="a" textValue="Ada">
        Ada
      </ListView.Item>
      <ListView.Item id="b" textValue="Bob">
        Bob
      </ListView.Item>
      <ListView.Item id="c" textValue="Cy">
        Cy
      </ListView.Item>
    </ListView>
  ));
  await flush();
  const rows = container.querySelectorAll('[role="row"]');
  press(rows[0]);
  await flush();
  press(rows[1]);
  await flush();
  press(rows[2]);
  await flush();
  assert.deepEqual(selected.sort(), ["a", "b"]);
  assert.equal(rows[0].getAttribute("data-selected"), "true");
  assert.equal(container.querySelectorAll(".list-view__selection-cell").length, 3);
  unmount();
});

test("list view: onAction without selection", async () => {
  const actions: string[] = [];
  const { container, unmount } = render(() => (
    <ListView aria-label="Files" onAction={(key) => actions.push(String(key))}>
      <ListView.Item id="a" textValue="Report">
        Report
      </ListView.Item>
    </ListView>
  ));
  await flush();
  press(container.querySelector('[role="row"]')!);
  await flush();
  assert.deepEqual(actions, ["a"]);
  assert.equal(container.querySelectorAll(".list-view__selection-cell").length, 0);
  unmount();
});

test("list view: eager JSX prop of a row wrapper holding a ui component (TITLE-JSX)", async () => {
  function Row(props: { id: string; label: unknown }) {
    return (
      <ListView.Item id={props.id} textValue={props.id}>
        {props.label as never}
      </ListView.Item>
    );
  }
  const { container, unmount } = render(() => (
    <ListView aria-label="Files">
      <Row
        id="a"
        label={
          <span>
            a.ts{" "}
            <Chip>
              <Chip.Label>M</Chip.Label>
            </Chip>
          </span>
        }
      />
    </ListView>
  ));
  await flush();
  assert.match(container.textContent ?? "", /a\.ts M/);
  unmount();
});
