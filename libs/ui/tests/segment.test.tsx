// DOM-target suite: `Segment` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation) on
// happy-dom: compound statics + variants, press selects (single, never empty by default), `onSelectionChange(key)`, two-way
// `selectedKey` signal both ways, controlled plain key, `allowsEmptySelection`, disabled item / group, indicator follows the
// selection, function children re-render on selection, live `size` / `variant` restyle in place, context outside a Segment.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Segment, SegmentRoot, SegmentItem, SegmentSeparator, segmentVariants } = await import("../src/components/segment/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));
const radios = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLButtonElement>("[role=radio]"));
const checked = (root: ParentNode) => radios(root).map((b) => b.getAttribute("aria-checked"));

test("segment: compound statics + variants", () => {
  assert.equal(Segment, SegmentRoot);
  assert.equal(Segment.Root, SegmentRoot);
  assert.equal(Segment.Item, SegmentItem);
  assert.equal(Segment.Separator, SegmentSeparator);
  assert.equal(segmentVariants().base(), "segment segment--md segment--default");
  assert.equal(segmentVariants({ size: "lg", variant: "ghost" }).base(), "segment segment--lg segment--ghost");
  assert.equal(segmentVariants().indicator(), "segment__indicator");
});

test("segment: press selects one item, never empties, onSelectionChange gets the key; indicator follows", async () => {
  const calls: unknown[] = [];
  const r = render(() => (
    <Segment aria-label="View" defaultSelectedKey="a" onSelectionChange={(k) => calls.push(k)}>
      <Segment.Item id="a">A</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="b">B</Segment.Item>
    </Segment>
  ));
  const [a, b] = radios(r.container);
  assert.deepEqual(checked(r.container), ["true", "false"]);
  assert.ok(a!.querySelector("[data-slot=segment-indicator]"));
  assert.equal(b!.querySelector("[data-slot=segment-indicator]"), null);
  b!.click();
  await flush();
  assert.deepEqual(checked(r.container), ["false", "true"]);
  assert.deepEqual(calls, ["b"]);
  assert.equal(b!.getAttribute("data-selected"), "true");
  b!.click(); // disallowEmptySelection: stays selected
  await flush();
  assert.deepEqual(checked(r.container), ["false", "true"]);
  await flush();
  assert.ok(b!.querySelector("[data-slot=segment-indicator]"));
  r.unmount();
});

test("segment: two-way selectedKey signal; plain key is controlled", async () => {
  const key = signal<string | null>("x");
  const r = render(() => (
    <>
      <Segment aria-label="Two-way" selectedKey={key} id="s1">
        <Segment.Item id="x">X</Segment.Item>
        <Segment.Item id="y">Y</Segment.Item>
      </Segment>
      <Segment aria-label="Controlled" selectedKey="p" id="s2">
        <Segment.Item id="p">P</Segment.Item>
        <Segment.Item id="q">Q</Segment.Item>
      </Segment>
    </>
  ));
  const s1 = r.container.querySelector("#s1")!;
  const s2 = r.container.querySelector("#s2")!;
  radios(s1)[1]!.click();
  await flush();
  assert.equal(key(), "y");
  assert.deepEqual(checked(s1), ["false", "true"]);
  key.set("x");
  await flush();
  assert.deepEqual(checked(s1), ["true", "false"]);
  radios(s2)[1]!.click();
  await flush();
  assert.deepEqual(checked(s2), ["true", "false"]);
  r.unmount();
});

test("segment: allowsEmptySelection, disabled item and group", async () => {
  const r = render(() => (
    <>
      <Segment aria-label="Empty" allowsEmptySelection defaultSelectedKey="a" id="s1">
        <Segment.Item id="a">A</Segment.Item>
        <Segment.Item id="b" isDisabled>
          B
        </Segment.Item>
      </Segment>
      <Segment aria-label="Off" isDisabled defaultSelectedKey="x" id="s2">
        <Segment.Item id="x">X</Segment.Item>
        <Segment.Item id="y">Y</Segment.Item>
      </Segment>
    </>
  ));
  const s1 = r.container.querySelector("#s1")!;
  radios(s1)[0]!.click();
  await flush();
  assert.deepEqual(checked(s1), ["false", "false"]);
  radios(s1)[1]!.click();
  await flush();
  assert.deepEqual(checked(s1), ["false", "false"]);
  assert.ok(radios(s1)[1]!.disabled);
  const s2 = r.container.querySelector("#s2")!;
  assert.equal(s2.getAttribute("data-disabled"), "true");
  radios(s2)[1]!.click();
  await flush();
  assert.deepEqual(checked(s2), ["true", "false"]);
  r.unmount();
});

test("segment: function children follow the selection", async () => {
  const r = render(() => (
    <Segment aria-label="Expand" defaultSelectedKey="a">
      <Segment.Item id="a">{({ isSelected }) => (isSelected() ? "A label" : "A")}</Segment.Item>
      <Segment.Item id="b">{({ isSelected }) => (isSelected() ? "B label" : "B")}</Segment.Item>
    </Segment>
  ));
  const [a, b] = radios(r.container);
  assert.equal(a!.textContent, "A label");
  assert.equal(b!.textContent, "B");
  b!.click();
  await flush();
  assert.equal(a!.textContent, "A");
  assert.equal(b!.textContent, "B label");
  r.unmount();
});

test("segment: live size / variant restyle root + items in place; parts outside a Segment have no BEM classes", async () => {
  const size = signal<"sm" | "md" | "lg">("sm");
  const variant = signal<"default" | "ghost">("default");
  const r = render(() => (
    <>
      <Segment aria-label="Live" size={size()} variant={variant()} id="s">
        <Segment.Item id="a" class="extra">
          A
        </Segment.Item>
      </Segment>
      <Segment.Separator id="lone" />
    </>
  ));
  const root = r.container.querySelector("#s")!;
  const item = radios(root)[0]!;
  assert.equal(root.className, "segment segment--sm segment--default");
  size.set("lg");
  variant.set("ghost");
  await flush();
  assert.equal(root.className, "segment segment--lg segment--ghost");
  assert.equal(radios(root)[0], item);
  assert.equal(item.className, "segment__item extra");
  assert.equal(r.container.querySelector("#lone")!.getAttribute("class"), null);
  r.unmount();
});
