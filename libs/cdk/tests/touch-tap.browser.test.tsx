// Touch taps on pressable parts nested in collection items (UI-TOOLS-FIX B1 2026-10-27). A touch tap fires
// pointerdown, pointerup, then pointerout / pointerleave (the finger is gone), then the compatibility mouse events and
// `click`. A press ends on the click; its document `pointerup` listener marks the pointerleave that follows as the
// end of the touch, not an exit. The grid row / cell `pointerup` handlers stopped propagation (the runtime's
// delegated stop is immediate at the document), so the nested press saw the pointerleave as an exit, ended without
// `onPress`, and the click found no press: a tapped Table selection checkbox / sortable column did nothing (Chromium +
// WebKit, real taps). The sequences are dispatched as Chromium and iOS Safari send them (ios-touch-press.browser.test).
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, type Signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { Checkbox } from "../checkbox/index.tsx";
import { GridList, GridListItem } from "../grid-list/index.tsx";
import { Tree, TreeItem, TreeItemContent } from "../tree/index.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "../table/index.tsx";
import type { Selection, SortDescriptor } from "../collections/types.ts";

afterEach(cleanup);
const screen = () => within(document.body);

type Tap = (el: Element) => void;

/** pointerleave on `el` and every ancestor (non-bubbling, as the browser fires it when the touch ends). */
function leave(el: Element, init: PointerEventInit): void {
  for (let node: Element | null = el; node; node = node.parentElement) node.dispatchEvent(new PointerEvent("pointerleave", { ...init, bubbles: false }));
}

/** One Chromium / Android touch tap (Playwright `page.tap` / `touchscreen.tap` order and sizes). */
const chromiumTap: Tap = (el) => {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  const touch = { ...at, pointerId: 7, pointerType: "touch", isPrimary: true, width: 2, height: 2, pressure: 0.5 };
  el.dispatchEvent(new PointerEvent("pointerover", { ...touch, button: -1, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...touch, button: 0, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerup", { ...touch, width: 1, height: 1, pressure: 0, button: 0, buttons: 0 }));
  el.dispatchEvent(new PointerEvent("pointerout", { ...touch, width: 1, height: 1, pressure: 0, button: -1, buttons: 0 }));
  leave(el, { ...touch, width: 1, height: 1, pressure: 0, button: -1, buttons: 0 });
  el.dispatchEvent(new MouseEvent("mouseover", at));
  el.dispatchEvent(new MouseEvent("mousedown", { ...at, button: 0, buttons: 1, detail: 1 }));
  el.dispatchEvent(new MouseEvent("mouseup", { ...at, button: 0, detail: 1 }));
  el.dispatchEvent(new PointerEvent("click", { ...at, pointerId: 7, pointerType: "touch", width: 1, height: 1, button: 0, detail: 1 }));
};

/** One iOS Safari tap (iOS 26.4: zero-size pointerup / pointerout, a `click` reported as a mouse pointer). */
const iosTap: Tap = (el) => {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  const touch = { ...at, pointerId: -229701493, pointerType: "touch", isPrimary: true, width: 40, height: 40, pressure: 0 };
  el.dispatchEvent(new PointerEvent("pointerover", { ...touch, button: -1, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...touch, button: 0, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerup", { ...touch, width: 0, height: 0, button: 0, buttons: 0 }));
  el.dispatchEvent(new PointerEvent("pointerout", { ...touch, width: 0, height: 0, button: -1, buttons: 0 }));
  leave(el, { ...touch, width: 0, height: 0, button: -1, buttons: 0 });
  el.dispatchEvent(new MouseEvent("mouseover", at));
  el.dispatchEvent(new MouseEvent("mousedown", { ...at, button: 0, buttons: 1, detail: 1 }));
  el.dispatchEvent(new MouseEvent("mouseup", { ...at, button: 0, detail: 1 }));
  el.dispatchEvent(
    new PointerEvent("click", { ...at, pointerId: touch.pointerId, pointerType: "mouse", width: 1, height: 1, pressure: 0, button: 0, detail: 1 }),
  );
};

/** The press waits for the click (and its 80 ms settle timer): let both run. */
const settle = async () => {
  flush();
  await new Promise((r) => setTimeout(r, 120));
  flush();
};

function Files(props: { selected: Signal<Selection>; sort: Signal<SortDescriptor | null> }) {
  return (
    <Table aria-label="Files" selectionMode="multiple" selectedKeys={props.selected} sortDescriptor={props.sort}>
      <TableHeader>
        <Column>
          <Checkbox slot="selection" />
        </Column>
        <Column id="name" isRowHeader allowsSorting>
          Name
        </Column>
        <Column id="type" allowsSorting>
          Type
        </Column>
      </TableHeader>
      <TableBody>
        <Row id="a">
          <Cell>
            <Checkbox slot="selection" />
          </Cell>
          <Cell>Games</Cell>
          <Cell>Folder</Cell>
        </Row>
        <Row id="b">
          <Cell>
            <Checkbox slot="selection" />
          </Cell>
          <Cell>bootmgr</Cell>
          <Cell>File</Cell>
        </Row>
      </TableBody>
    </Table>
  );
}

const label = (box: Element) => box.closest("label")!;

describe.each([
  ["Chromium", chromiumTap],
  ["iOS Safari", iosTap],
] as const)("%s touch taps on pressables nested in collection items", (_engine, tap) => {
  it("Table: a tapped row selection checkbox toggles its row once, a second tap clears it", async () => {
    const selected = signal<Selection>(new Set());
    const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
    render(() => <Files selected={selected} sort={sort} />);
    tap(label(screen().getByRole("checkbox", { name: /bootmgr/ })));
    await settle();
    expect([...(selected() as Set<string>)]).toEqual(["b"]);
    expect(screen().getByRole("checkbox", { name: /bootmgr/ })).toBeChecked();
    tap(label(screen().getByRole("checkbox", { name: /bootmgr/ })));
    await settle();
    expect([...(selected() as Set<string>)]).toEqual([]);
  });

  it("Table: a tapped select-all checkbox selects every row", async () => {
    const selected = signal<Selection>(new Set());
    const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
    render(() => <Files selected={selected} sort={sort} />);
    tap(label(screen().getByRole("checkbox", { name: "Select All" })));
    await settle();
    expect(selected()).toBe("all");
  });

  it("Table: a tapped sortable column header sorts once", async () => {
    const selected = signal<Selection>(new Set());
    const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
    render(() => <Files selected={selected} sort={sort} />);
    tap(screen().getByRole("columnheader", { name: "Type" }));
    await settle();
    expect(sort()).toEqual({ column: "type", direction: "ascending" });
    expect(screen().getByRole("columnheader", { name: "Type" })).toHaveAttribute("aria-sort", "ascending");
    tap(screen().getByRole("columnheader", { name: "Type" }));
    await settle();
    expect(sort()).toEqual({ column: "type", direction: "descending" });
  });

  it("Table: a tapped body cell selects its row", async () => {
    const selected = signal<Selection>(new Set());
    const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
    render(() => <Files selected={selected} sort={sort} />);
    tap(screen().getByRole("rowheader", { name: "Games" }));
    await settle();
    expect([...(selected() as Set<string>)]).toEqual(["a"]);
  });

  it("GridList: a tapped selection checkbox toggles its item", async () => {
    const selected = signal<Selection>(new Set());
    render(() => (
      <GridList aria-label="Pets" selectionMode="multiple" selectedKeys={selected}>
        <GridListItem id="cat" textValue="Cat">
          <Checkbox slot="selection" /> Cat
        </GridListItem>
        <GridListItem id="dog" textValue="Dog">
          <Checkbox slot="selection" /> Dog
        </GridListItem>
      </GridList>
    ));
    tap(label(screen().getAllByRole("checkbox")[1]!));
    await settle();
    expect([...(selected() as Set<string>)]).toEqual(["dog"]);
  });

  it("Tree: a tapped selection checkbox toggles its item", async () => {
    const selected = signal<Selection>(new Set());
    render(() => (
      <Tree aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        <TreeItem id="docs" textValue="Documents">
          <TreeItemContent>
            <Checkbox slot="selection" /> Documents
          </TreeItemContent>
        </TreeItem>
        <TreeItem id="photos" textValue="Photos">
          <TreeItemContent>
            <Checkbox slot="selection" /> Photos
          </TreeItemContent>
        </TreeItem>
      </Tree>
    ));
    tap(label(screen().getAllByRole("checkbox")[1]!));
    await settle();
    expect([...(selected() as Set<string>)]).toEqual(["photos"]);
  });
});
