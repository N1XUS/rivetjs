// DOM-target suite: FileTree (Rivet addition): expand button toggles child rows and `data-expanded`, multiple selection
// through row press reaches `onSelectionChange` (keyboard / resume: story `/file-tree`); an eager JSX `title` holding ui
// components renders, stays live across collection rebuilds and is disposed with its row (TITLE-JSX).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { FileTree } = await import("../src/components/file-tree/index.ts");
const { Chip } = await import("../src/components/chip/index.ts");
const { Collection } = await import("@rivetjs/cdk/collections/components");
const { signal, onCleanup } = await import("@rivetjs/reactivity");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

test("file tree: chevron expands and collapses", async () => {
  const expanded: string[][] = [];
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files" onExpandedChange={(keys) => expanded.push([...keys].map(String))}>
      <FileTree.Item id="src" title="src">
        <FileTree.Item id="index" title="index.ts" />
      </FileTree.Item>
    </FileTree>
  ));
  await flush();
  assert.equal(container.querySelectorAll('[role="row"]').length, 1);
  press(container.querySelector('[slot="chevron"]')!);
  await flush();
  assert.deepEqual(expanded.at(-1), ["src"]);
  assert.equal(container.querySelectorAll('[role="row"]').length, 2);
  assert.equal(container.querySelector('[data-key="src"], [role="row"]')!.getAttribute("data-expanded"), "true");
  press(container.querySelector('[slot="chevron"]')!);
  await flush();
  assert.deepEqual(expanded.at(-1), []);
  assert.equal(container.querySelectorAll('[role="row"]').length, 1);
  unmount();
});

test("file tree: sections group rows; a section's folder expands (PRO-LAST)", async () => {
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files">
      <FileTree.Section id="project">
        <FileTree.Header>Project</FileTree.Header>
        <FileTree.Item id="src" title="src">
          <FileTree.Item id="index" title="index.ts" />
        </FileTree.Item>
      </FileTree.Section>
      <FileTree.Section id="config" aria-label="Config">
        <FileTree.Item id="pkg" title="package.json" />
      </FileTree.Section>
    </FileTree>
  ));
  await flush();
  const groups = container.querySelectorAll('[role="rowgroup"]');
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.getAttribute("class"), "file-tree__section");
  const header = groups[0]!.querySelector(".file-tree__section-header")!;
  assert.equal(header.textContent, "Project");
  assert.equal(groups[0]!.getAttribute("aria-labelledby"), header.querySelector("[id]")?.id ?? header.id);
  assert.equal(groups[1]!.getAttribute("aria-label"), "Config");
  assert.equal(groups[0]!.querySelectorAll('[data-slot="file-tree-item"]').length, 1);
  press(groups[0]!.querySelector('[slot="chevron"]')!);
  await flush();
  assert.equal(groups[0]!.querySelectorAll('[data-slot="file-tree-item"]').length, 2);
  assert.equal(groups[1]!.querySelectorAll('[data-slot="file-tree-item"]').length, 1);
  unmount();
});

test("file tree: multiple selection", async () => {
  let selected: string[] = [];
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files" selectionMode="multiple" onSelectionChange={(keys) => (selected = keys === "all" ? ["all"] : [...keys].map(String))}>
      <FileTree.Item id="a" title="a.md" />
      <FileTree.Item id="b" title="b.md" />
    </FileTree>
  ));
  await flush();
  const rows = container.querySelectorAll('[role="row"]');
  press(rows[0]);
  await flush();
  press(rows[1]);
  await flush();
  assert.deepEqual(selected.sort(), ["a", "b"]);
  assert.equal(container.querySelectorAll(".file-tree__selection-cell").length, 2);
  unmount();
});

test("file tree: eager JSX title with ui components renders (TITLE-JSX)", async () => {
  // Built by the caller while the tree's collection build pass (a computed) runs: the Chip's spread binding writes its
  // children signal there — threw "Signal writes are not allowed during computed evaluation" before the hidden root.
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files">
      <FileTree.Item
        id="app"
        textValue="app.tsx"
        title={
          <span>
            app.tsx{" "}
            <Chip size="sm" variant="soft" color="warning">
              <Chip.Label>M</Chip.Label>
            </Chip>
          </span>
        }
      />
    </FileTree>
  ));
  await flush();
  const title = container.querySelector('[data-slot="file-tree-title"]')!;
  assert.match(title.textContent ?? "", /app\.tsx\s*M/);
  assert.ok(title.querySelector('[data-slot="chip"], .chip'));
  unmount();
});

test("file tree: eager JSX title stays live across rebuilds and is disposed with its row (TITLE-JSX)", async () => {
  const items = signal([{ id: "a" }, { id: "b" }]);
  const tone = signal("one");
  const disposed: string[] = [];
  function Probe(props: { id: string }) {
    onCleanup(() => disposed.push(props.id));
    return <b>{props.id}</b>;
  }
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files">
      <Collection items={items}>
        {(item: { id: string }) => (
          <FileTree.Item
            id={item.id}
            textValue={item.id}
            title={
              <span class={tone()}>
                <Probe id={item.id} />
              </span>
            }
          />
        )}
      </Collection>
    </FileTree>
  ));
  await flush();
  const classes = () => [...container.querySelectorAll('[data-slot="file-tree-title"] > span')].map((s) => s.className);
  assert.deepEqual(classes(), ["one", "one"]);
  // Rebuild: rows a / b keep their DOM (same render) — its bindings belong to the first build, which they keep alive.
  items.set([...items(), { id: "c" }]);
  await flush();
  tone.set("two");
  await flush();
  assert.deepEqual(classes(), ["two", "two", "two"]);
  assert.deepEqual(disposed, []);
  // Rows a / b leave: their first-build titles go with them, and the second build's unused a / b titles with that build
  // (each `items` row is its own segment); row c keeps its second-build title.
  items.set([{ id: "c" }]);
  await flush();
  assert.deepEqual(disposed.sort(), ["a", "a", "b", "b"]);
  assert.deepEqual(classes(), ["two"]);
  // Unmount disposes the rest: the second build's c (row c) and the third build's (the current build).
  unmount();
  assert.deepEqual(disposed.sort(), ["a", "a", "b", "b", "c", "c"]);
});
