// DOM-target suite: `ListBox` (upstream tests/components/list-box/list-box.test.tsx ported to happy-dom): listbox role + BEM +
// data-slot, selection via an option press (`onSelectionChange` with the key), sections + `onAction` with selectionMode none.
// Rivet: item / indicator / section classes, `ListBoxItemContext` (indicator `data-visible` + checkmark offset follow the selection),
// `variant="danger"`, function children with accessor render props, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Header } = await import("../src/components/header/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { ListBox, ListBoxRoot, listboxVariants } = await import("../src/components/list-box/index.ts");
const { ListBoxItem, ListBoxItemRoot, ListBoxItemIndicator, listboxItemVariants } = await import("../src/components/list-box-item/index.ts");
const { ListBoxSection, listboxSectionVariants } = await import("../src/components/list-box-section/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

const Users = (props: { onSelectionChange?: (keys: unknown) => void }) => (
  <ListBox aria-label="Users" data-testid="users" selectionMode="single" onSelectionChange={props.onSelectionChange as never}>
    <ListBox.Item id="bob" textValue="Bob">
      <Label>Bob</Label>
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Item id="fred" textValue="Fred">
      <Label>Fred</Label>
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Item id="martha" textValue="Martha">
      <Label>Martha</Label>
      <ListBox.ItemIndicator />
    </ListBox.Item>
  </ListBox>
);

const options = (root: ParentNode) => [...root.querySelectorAll("[role=option]")] as HTMLElement[];

test("list-box: index exports", () => {
  assert.equal(ListBox, ListBoxRoot);
  assert.equal(ListBox.Item, ListBoxItem);
  assert.equal(ListBox.ItemIndicator, ListBoxItemIndicator);
  assert.equal(ListBox.Section, ListBoxSection);
  assert.equal(ListBoxItem, ListBoxItemRoot);
  assert.equal(listboxVariants(), "list-box list-box--default");
  assert.equal(listboxItemVariants().item(), "list-box-item list-box-item--default");
  assert.equal(listboxSectionVariants(), "list-box-section");
});

test("list-box: listbox role, BEM, data-slot", () => {
  const r = render(() => <Users />);
  const lb = r.container.querySelector("[role=listbox]")!;
  assert.equal(lb.getAttribute("aria-label"), "Users");
  assert.equal(lb.getAttribute("data-slot"), "list-box");
  assert.match(lb.className, /\blist-box\b/);
  const item = r.container.querySelector('[data-slot="list-box-item"]')!;
  assert.ok(item);
  assert.equal(item.className, "list-box-item list-box-item--default");
  const ind = item.querySelector("[data-slot=list-box-item-indicator]")!;
  assert.equal(ind.className, "list-box-item__indicator");
  assert.equal(ind.getAttribute("aria-hidden"), "true");
  assert.ok(ind.querySelector("svg[data-slot=list-box-item-indicator--checkmark]"));
  r.unmount();
});

test("list-box: pressing an option selects it (onSelectionChange), indicator follows", async () => {
  const calls: unknown[][] = [];
  const r = render(() => <Users onSelectionChange={(k) => calls.push([...(k as Set<unknown>)])} />);
  assert.equal(options(r.container).length, 3);
  const fred = options(r.container)[1]!;
  press(fred);
  await flush();
  assert.deepEqual(calls, [["fred"]]);
  assert.equal(fred.getAttribute("aria-selected"), "true");
  assert.equal(r.container.querySelectorAll("[aria-selected=true]").length, 1);
  const ind = fred.querySelector("[data-slot=list-box-item-indicator]")!;
  assert.equal(ind.getAttribute("data-visible"), "true");
  assert.equal(ind.querySelector("svg")!.getAttribute("stroke-dashoffset"), "48");
  assert.equal(options(r.container)[0]!.querySelector("[data-slot=list-box-item-indicator]")!.hasAttribute("data-visible"), false);
  assert.equal(options(r.container)[0]!.querySelector("svg")!.getAttribute("stroke-dashoffset"), "72");
  r.unmount();
});

test("list-box: sections + onAction with selectionMode none", async () => {
  const actions: unknown[] = [];
  const r = render(() => (
    <ListBox aria-label="File actions" selectionMode="none" onAction={(k) => actions.push(k)}>
      <ListBox.Section class="mine">
        <Header>Actions</Header>
        <ListBox.Item id="new-file" textValue="New file">
          <Label>New file</Label>
        </ListBox.Item>
        <ListBox.Item id="copy-link" textValue="Copy link">
          <Label>Copy link</Label>
        </ListBox.Item>
      </ListBox.Section>
    </ListBox>
  ));
  const section = r.container.querySelector("section")!;
  assert.equal(section.className, "list-box-section mine");
  assert.equal(section.getAttribute("role"), "group");
  press(options(r.container)[1]!);
  await flush();
  assert.deepEqual(actions, ["copy-link"]);
  r.unmount();
});

test("list-box: danger variant, class on items, function children get accessor render props", () => {
  const r = render(() => (
    <ListBox aria-label="x" variant="danger" class="w-64" selectionMode="multiple" defaultSelectedKeys={["a"]}>
      <ListBox.Item id="a" variant="danger" class="extra" textValue="A">
        {({ isSelected }: { isSelected: () => boolean }) => <span id="fa">{isSelected() ? "on" : "off"}</span>}
      </ListBox.Item>
    </ListBox>
  ));
  assert.equal(r.container.querySelector("[role=listbox]")!.className, "list-box list-box--danger w-64");
  assert.equal(r.container.querySelector("[role=option]")!.className, "list-box-item list-box-item--danger extra");
  assert.equal(r.container.querySelector("#fa")!.textContent, "on");
  r.unmount();
});

test("list-box: Indicator outside an item gets only the caller's class", () => {
  const r = render(() => <ListBoxItemIndicator class="x" />);
  assert.equal(r.container.querySelector("[data-slot=list-box-item-indicator]")!.className, "x");
  r.unmount();
});

// happy-dom has no layout: supply the viewport dimensions used by the real scroll driver.
test("list-box: virtualized 10k window, keyboard scrolling, selection and typeahead", async () => {
  const items = Array.from({ length: 10000 }, (_, id) => ({ id: String(id), name: id === 9000 ? "Zebra" : `Item ${id}` }));
  const selected: unknown[] = [];
  const r = render(() => (
    <ListBox
      virtualized
      aria-label="Large list"
      items={items}
      selectionMode="single"
      initialSize={{ width: 300, height: 180 }}
      onSelectionChange={(keys) => selected.push(keys === "all" ? keys : [...keys])}
      ref={(el) => {
        el.getBoundingClientRect = () => new DOMRect(0, 0, 300, 180);
        Object.defineProperties(el, {
          clientWidth: { configurable: true, value: 300 },
          clientHeight: { configurable: true, value: 180 },
          offsetWidth: { configurable: true, value: 300 },
          offsetHeight: { configurable: true, value: 180 },
          scrollHeight: { configurable: true, value: 360000 },
        });
      }}
    >
      {(item: { id: string; name: string }) => (
        <ListBox.Item
          id={item.id}
          textValue={item.name}
          ref={(el) => {
            el.getBoundingClientRect = () => new DOMRect(0, Number(item.id) * 36 - (el.closest<HTMLElement>("[role=listbox]")?.scrollTop ?? 0), 300, 36);
          }}
        >
          {item.name}
        </ListBox.Item>
      )}
    </ListBox>
  ));
  try {
    for (let i = 0; i < 100 && !options(r.container).length; i++) await flush();
    const list = r.container.querySelector<HTMLElement>("[role=listbox]")!;
    assert.ok(options(list).length > 0 && options(list).length < 30);
    const first = options(list)[0];
    assert.equal(first.getAttribute("aria-setsize"), "10000");
    assert.equal(first.getAttribute("aria-posinset"), "1");
    first.focus();
    press(first);
    await flush();
    assert.equal(first.getAttribute("aria-selected"), "true");
    const key = async (value: string) => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
      await flush();
      list.dispatchEvent(new Event("scroll"));
      await flush();
    };
    for (let i = 0; i < 8; i++) await key("ArrowDown");
    assert.equal(document.activeElement?.getAttribute("data-key"), "8");
    assert.ok(list.scrollTop > 0);
    await key("End");
    assert.equal(document.activeElement?.getAttribute("data-key"), "9999");
    assert.ok(list.scrollTop >= 359820);
    await key(" ");
    assert.equal(document.activeElement?.getAttribute("aria-selected"), "true");
    assert.deepEqual(selected.at(-1), ["9999"]);
    await key("Home");
    assert.equal(document.activeElement?.getAttribute("data-key"), "0");
    assert.equal(list.scrollTop, 0);
    await key("z");
    assert.equal(document.activeElement?.getAttribute("data-key"), "9000");
    assert.ok(list.scrollTop > 0);
    assert.ok(options(list).length < 30);
  } finally {
    r.unmount();
  }
});
