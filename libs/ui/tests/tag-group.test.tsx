// DOM-target suite: `TagGroup` + `Tag` (upstream tests/components/tag-group/tag-group.test.tsx + tag/tag.test.tsx ported to
// happy-dom): data-slot + BEM on root / list / tags, grid + rows, Label names the grid, single / multiple selection, disabled tags +
// disabledKeys, default remove button + onRemove, Delete key removes, size / variant modifiers; Rivet: custom `Tag.RemoveButton`
// replaces the default, function children, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Label } = await import("../src/components/label/index.ts");
const { Tag, TagRoot, TagRemoveButton, tagVariants } = await import("../src/components/tag/index.ts");
const { TagGroup, TagGroupRoot, TagGroupList, tagGroupVariants } = await import("../src/components/tag-group/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const rows = (root: ParentNode) => [...root.querySelectorAll("[role=row]")] as HTMLElement[];
const row = (root: ParentNode, name: string) => rows(root).find((r) => r.textContent!.includes(name))!;

const Basic = (props: Record<string, unknown>) => (
  <TagGroup aria-label="Categories" selectionMode="single" {...props}>
    <TagGroup.List>
      <Tag id="news">News</Tag>
      <Tag id="travel">Travel</Tag>
    </TagGroup.List>
  </TagGroup>
);

test("tag-group: index exports", () => {
  assert.equal(TagGroup, TagGroupRoot);
  assert.equal(TagGroup.List, TagGroupList);
  assert.equal(Tag, TagRoot);
  assert.equal(Tag.RemoveButton, TagRemoveButton);
  assert.equal(tagGroupVariants().base(), "tag-group");
  assert.equal(tagVariants().base(), "tag tag--md tag--default");
});

test("tag-group: data-slot + BEM on root and list, tags as rows of a grid", () => {
  const r = render(() => <Basic />);
  assert.match(r.container.querySelector('[data-slot="tag-group"]')!.className, /\btag-group\b/);
  const list = r.container.querySelector('[data-slot="tag-group-list"]')!;
  assert.match(list.className, /tag-group__list/);
  assert.equal(list.getAttribute("role"), "grid");
  assert.equal(r.container.querySelectorAll('[data-slot="tag"]').length, 2);
  assert.equal(rows(r.container).length, 2);
  assert.equal(row(r.container, "News").className, "tag tag--md tag--default");
  r.unmount();
});

test("tag-group: Label names the grid", () => {
  const r = render(() => (
    <TagGroup selectionMode="single">
      <Label>Amenities</Label>
      <TagGroup.List>
        <Tag id="laundry">Laundry</Tag>
      </TagGroup.List>
    </TagGroup>
  ));
  const grid = r.container.querySelector("[role=grid]")!;
  const label = document.getElementById(grid.getAttribute("aria-labelledby")!.split(" ")[0]!)!;
  assert.equal(label.textContent, "Amenities");
  r.unmount();
});

test("tag-group: auto form — label names the grid, list wraps the tags, items + render function select", async () => {
  const calls: unknown[][] = [];
  const items = [
    { id: "laundry", name: "Laundry" },
    { id: "pool", name: "Pool" },
  ];
  const r = render(() => (
    <TagGroup
      label="Amenities"
      description="Pick any"
      selectionMode="single"
      items={items}
      onSelectionChange={(k) => void calls.push([...(k as Set<unknown>)])}
    >
      {(i: { id: string; name: string }) => <Tag id={i.id}>{i.name}</Tag>}
    </TagGroup>
  ));
  const grid = r.container.querySelector("[role=grid]")!;
  assert.ok(grid.classList.contains("tag-group__list"));
  assert.equal(document.getElementById(grid.getAttribute("aria-labelledby")!.split(" ")[0]!)!.textContent, "Amenities");
  assert.equal(rows(grid).length, 2);
  assert.ok(r.container.querySelector('[data-slot="description"]'));
  press(row(r.container, "Pool"));
  await flush();
  assert.deepEqual(calls, [["pool"]]);
  r.unmount();
});

test("tag-group: single selection toggles (onSelectionChange)", async () => {
  const calls: unknown[][] = [];
  const r = render(() => <Basic onSelectionChange={(k: Set<unknown>) => calls.push([...k])} />);
  const news = row(r.container, "News");
  assert.equal(news.getAttribute("aria-selected"), "false");
  press(news);
  await flush();
  assert.equal(news.getAttribute("aria-selected"), "true");
  assert.deepEqual(calls, [["news"]]);
  r.unmount();
});

test("tag-group: multiple selection", async () => {
  const calls: unknown[][] = [];
  const r = render(() => <Basic selectionMode="multiple" onSelectionChange={(k: Set<unknown>) => calls.push([...k])} />);
  press(row(r.container, "News"));
  await flush();
  press(row(r.container, "Travel"));
  await flush();
  assert.deepEqual(calls.at(-1)!.sort(), ["news", "travel"]);
  r.unmount();
});

test("tag-group: disabled tag + disabledKeys", () => {
  const r = render(() => (
    <TagGroup aria-label="Categories" selectionMode="single" disabledKeys={["travel"]}>
      <TagGroup.List>
        <Tag isDisabled id="news">
          News
        </Tag>
        <Tag id="travel">Travel</Tag>
        <Tag id="food">Food</Tag>
      </TagGroup.List>
    </TagGroup>
  ));
  assert.equal(row(r.container, "News").getAttribute("aria-disabled"), "true");
  assert.equal(row(r.container, "Travel").getAttribute("aria-disabled"), "true");
  assert.notEqual(row(r.container, "Food").getAttribute("aria-disabled"), "true");
  r.unmount();
});

test("tag-group: default remove button + onRemove; Delete removes the focused tag", async () => {
  const removed: unknown[][] = [];
  const r = render(() => <Basic onRemove={(k: Set<unknown>) => removed.push([...k])} />);
  const btn = row(r.container, "News").querySelector('[data-slot="tag-remove-button"]') as HTMLElement;
  assert.ok(btn);
  assert.match(btn.className, /tag__remove-button/);
  assert.match(btn.getAttribute("aria-label")!, /Remove/);
  press(btn);
  await flush();
  assert.deepEqual(removed, [["news"]]);
  const travel = row(r.container, "Travel");
  travel.focus();
  travel.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual(removed.at(-1), ["travel"]);
  r.unmount();
});

test("tag-group: no remove button without onRemove", () => {
  const r = render(() => <Basic />);
  assert.equal(r.container.querySelector('[data-slot="tag-remove-button"]'), null);
  r.unmount();
});

test("tag-group: size + variant modifiers on tags", () => {
  const r = render(() => <Basic size="lg" variant="surface" />);
  const cls = row(r.container, "News").className;
  assert.match(cls, /tag--lg/);
  assert.match(cls, /tag--surface/);
  r.unmount();
});

test("tag: custom RemoveButton replaces the default; function children", () => {
  const r = render(() => (
    <TagGroup aria-label="x" onRemove={() => {}}>
      <TagGroup.List>
        <Tag id="a" textValue="A">
          A<Tag.RemoveButton class="mine">x</Tag.RemoveButton>
        </Tag>
        <Tag id="b" textValue="B">
          {((rp: { allowsRemoving: boolean }) => <span id="fb">{rp.allowsRemoving ? "removable" : "fixed"}</span>) as never}
        </Tag>
      </TagGroup.List>
    </TagGroup>
  ));
  const a = row(r.container, "A");
  const btns = a.querySelectorAll('[data-slot="tag-remove-button"]');
  assert.equal(btns.length, 1);
  assert.match((btns[0] as HTMLElement).className, /tag__remove-button mine$/);
  assert.equal(r.container.querySelector("#fb")!.textContent, "removable");
  r.unmount();
});

test("tag (upstream): custom RemoveButton child calls onRemove", async () => {
  const removed: unknown[][] = [];
  const r = render(() => (
    <TagGroup aria-label="Categories" selectionMode="single" onRemove={(k: Set<unknown>) => removed.push([...k])}>
      <TagGroup.List>
        <Tag id="news" textValue="News">
          News
          <Tag.RemoveButton data-testid="custom-remove" />
        </Tag>
      </TagGroup.List>
    </TagGroup>
  ));
  assert.equal(r.container.querySelectorAll('[data-slot="tag-remove-button"]').length, 1);
  const btn = r.container.querySelector("[data-testid=custom-remove]")!;
  assert.ok(btn.querySelector("svg[data-slot=close-button-icon]"));
  press(btn);
  await flush();
  assert.deepEqual(removed, [["news"]]);
  r.unmount();
});
