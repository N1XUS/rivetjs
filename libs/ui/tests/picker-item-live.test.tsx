// DOM-target suite: the shared `.Item` part of the select-like pickers (`ListBoxItemWithIndicator`) keeps a `{expr}` child live
// (T22 fix round: it used to be read once). Select / ComboBox / Autocomplete / CellSelect / InlineSelect, auto form, happy-dom;
// `items` next to compound children renders the compound form only.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Select } = await import("../src/components/select/index.ts");
const { ComboBox } = await import("../src/components/combo-box/index.ts");
const { Autocomplete } = await import("../src/components/autocomplete/index.ts");
const { CellSelect } = await import("../src/components/cell-select/index.ts");
const { InlineSelect } = await import("../src/components/inline-select/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const options = () => [...document.querySelectorAll("[role=option]")] as HTMLElement[];

type Picker = { name: string; slot: string; mount: (name: () => string) => unknown };
const PICKERS: Picker[] = [
  {
    name: "Select",
    slot: "select-trigger",
    mount: (name) => (
      <Select label="Language">
        <Select.Item id="a">{name()}</Select.Item>
        <Select.Item id="b">Static</Select.Item>
      </Select>
    ),
  },
  {
    name: "ComboBox",
    slot: "combo-box-trigger",
    mount: (name) => (
      <ComboBox label="Language">
        <ComboBox.Item id="a">{name()}</ComboBox.Item>
        <ComboBox.Item id="b">Static</ComboBox.Item>
      </ComboBox>
    ),
  },
  {
    name: "Autocomplete",
    slot: "autocomplete-trigger",
    mount: (name) => (
      <Autocomplete label="Language">
        <Autocomplete.Item id="a">{name()}</Autocomplete.Item>
        <Autocomplete.Item id="b">Static</Autocomplete.Item>
      </Autocomplete>
    ),
  },
  {
    name: "CellSelect",
    slot: "cell-select-trigger",
    mount: (name) => (
      <CellSelect label="Language">
        <CellSelect.Item id="a">{name()}</CellSelect.Item>
        <CellSelect.Item id="b">Static</CellSelect.Item>
      </CellSelect>
    ),
  },
  {
    name: "InlineSelect",
    slot: "inline-select-trigger",
    mount: (name) => (
      <InlineSelect aria-label="Language" items={[{ id: "a" }, { id: "b" }]}>
        {(item: { id: string }) => <InlineSelect.Item id={item.id}>{item.id === "a" ? name() : "Static"}</InlineSelect.Item>}
      </InlineSelect>
    ),
  },
];

for (const p of PICKERS) {
  test(`${p.name}.Item: a {expr} child stays live, the option node is kept`, async () => {
    const name = signal("English");
    const r = render(() => p.mount(name) as never);
    press(document.querySelector(`[data-slot="${p.slot}"]`)!);
    await flush();
    const first = options().find((o) => o.textContent!.includes("English"));
    assert.ok(first, `${p.name}: option rendered`);
    name.set("Deutsch");
    await flush();
    assert.ok(first.textContent!.includes("Deutsch"), `${p.name}: option text follows the signal (got "${first.textContent}")`);
    assert.ok(first.isConnected, `${p.name}: same option node`);
    assert.ok(options().some((o) => o.textContent!.includes("Static")));
    r.unmount();
  });
}

test("items next to compound children: the compound form renders once (no auto Trigger / Popover around it)", async () => {
  const { ListBox } = await import("../src/components/list-box/index.ts");
  const r = render(
    () =>
      (
        // @ts-expect-error: the types reject `items` next to compound parts; the runtime falls back to the compound form.
        <CellSelect aria-label="Language" items={[{ id: "en" }] as { id: string }[]}>
          <CellSelect.Trigger>
            <CellSelect.Value />
          </CellSelect.Trigger>
          <CellSelect.Popover>
            <ListBox>
              <ListBox.Item id="en">English</ListBox.Item>
            </ListBox>
          </CellSelect.Popover>
        </CellSelect>
      ) as never,
  );
  assert.equal(document.querySelectorAll('[data-slot="cell-select-trigger"]').length, 1);
  r.unmount();
});

// Live `items` on the auto forms (T22 fix round F6): append / remove keep the unchanged rows' nodes.
type Row = { id: string; name: string };
const LIVE: { name: string; slot?: string; rows: string; mount: (items: () => Row[]) => unknown }[] = [
  {
    name: "Select",
    slot: "select-trigger",
    rows: "[role=option]",
    mount: (items) => (
      <Select label="L" items={items()}>
        {(r: Row) => <Select.Item id={r.id}>{r.name}</Select.Item>}
      </Select>
    ),
  },
  {
    name: "ComboBox",
    slot: "combo-box-trigger",
    rows: "[role=option]",
    mount: (items) => (
      <ComboBox label="L" items={items()}>
        {(r: Row) => <ComboBox.Item id={r.id}>{r.name}</ComboBox.Item>}
      </ComboBox>
    ),
  },
  {
    name: "Autocomplete",
    slot: "autocomplete-trigger",
    rows: "[role=option]",
    mount: (items) => (
      <Autocomplete label="L" items={items()}>
        {(r: Row) => <Autocomplete.Item id={r.id}>{r.name}</Autocomplete.Item>}
      </Autocomplete>
    ),
  },
  {
    name: "CellSelect",
    slot: "cell-select-trigger",
    rows: "[role=option]",
    mount: (items) => (
      <CellSelect label="L" items={items()}>
        {(r: Row) => <CellSelect.Item id={r.id}>{r.name}</CellSelect.Item>}
      </CellSelect>
    ),
  },
  {
    name: "InlineSelect",
    slot: "inline-select-trigger",
    rows: "[role=option]",
    mount: (items) => (
      <InlineSelect aria-label="L" items={items()}>
        {(r: Row) => <InlineSelect.Item id={r.id}>{r.name}</InlineSelect.Item>}
      </InlineSelect>
    ),
  },
  {
    name: "TagGroup",
    rows: "[role=row]",
    mount: (items) => (
      <TagGroup label="L" items={items()}>
        {(r: Row) => <Tag id={r.id}>{r.name}</Tag>}
      </TagGroup>
    ),
  },
];
const { TagGroup } = await import("../src/components/tag-group/index.ts");
const { Tag } = await import("../src/components/tag/index.ts");

for (const p of LIVE) {
  test(`${p.name}: live items append / remove keep the unchanged rows`, async () => {
    const items = signal<Row[]>([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ]);
    const r = render(() => p.mount(items) as never);
    if (p.slot) press(document.querySelector(`[data-slot="${p.slot}"]`)!);
    await flush();
    const rows = () => [...document.querySelectorAll(p.rows)] as HTMLElement[];
    const text = () => rows().map((e) => e.textContent!.trim());
    assert.deepEqual(text(), ["Alpha", "Beta"], `${p.name}: initial rows`);
    const alpha = rows()[0]!;
    items.set([...items(), { id: "c", name: "Gamma" }]);
    await flush();
    assert.deepEqual(text(), ["Alpha", "Beta", "Gamma"], `${p.name}: append`);
    assert.ok(rows()[0] === alpha, `${p.name}: Alpha kept on append`);
    items.set(items().filter((x) => x.id !== "b"));
    await flush();
    assert.deepEqual(text(), ["Alpha", "Gamma"], `${p.name}: remove`);
    assert.ok(rows()[0] === alpha, `${p.name}: Alpha kept on remove`);
    r.unmount();
    document.body.innerHTML = "";
  });
}

test("Breadcrumbs items: live (id-less entries keyed by index) — a label edit and an append show", async () => {
  const { Breadcrumbs } = await import("../src/components/breadcrumbs/index.ts");
  const items = signal<{ label: string; href?: string }[]>([{ label: "Home", href: "#h" }, { label: "Docs", href: "#d" }, { label: "Here" }]);
  const r = render(() => (<Breadcrumbs items={items()} />) as never);
  const lis = () => [...document.querySelectorAll('[data-slot="breadcrumbs-item"]')] as HTMLElement[];
  assert.deepEqual(
    lis().map((li) => li.textContent!.trim()),
    ["Home", "Docs", "Here"],
  );
  items.set([{ label: "Start", href: "#h" }, ...items().slice(1)]);
  await flush();
  assert.equal(lis()[0]!.textContent!.trim(), "Start");
  items.set([...items(), { label: "Deeper" }]);
  await flush();
  assert.equal(lis().length, 4);
  assert.deepEqual(
    lis().map((li) => li.textContent!.trim()),
    ["Start", "Docs", "Here", "Deeper"],
  );
  r.unmount();
});
