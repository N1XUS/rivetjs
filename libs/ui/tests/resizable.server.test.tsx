// Server-target suite: `Resizable` (Rivet addition: shadcn/ui Resizable API on react-resizable-panels behaviour from
// `@rivetjs/cdk/resizable`, HeroUI look) SSR — BEM classes + shadcn `data-slot`s on group / panel / handle, `class` merged
// (panel class on the inner element), panel sizes from the first byte (cdk inline flex styles), `withHandle` grip with the
// lucide grip for the group's axis, index exports + compound parts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Resizable, ResizableHandle, ResizablePanel, ResizablePanelGroup, resizableVariants } from "../index.ts";

const Fixture = (props: { orientation?: "horizontal" | "vertical"; withHandle?: boolean }) => (
  <ResizablePanelGroup id="g" orientation={props.orientation} class="rounded-lg border">
    <ResizablePanel id="a" defaultSize="25%" class="p-4">
      one
    </ResizablePanel>
    <ResizableHandle id="h" withHandle={props.withHandle} />
    <ResizablePanel id="b">two</ResizablePanel>
  </ResizablePanelGroup>
);
const tag = (html: string, id: string) => new RegExp(`<div[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";

test("resizable: index exports + compound parts", () => {
  assert.equal(Resizable, ResizablePanelGroup);
  assert.equal(Resizable.Group, ResizablePanelGroup);
  assert.equal(Resizable.Panel, ResizablePanel);
  assert.equal(Resizable.Handle, ResizableHandle);
  assert.equal(resizableVariants().handle(), "resizable__handle");
});

test("resizable SSR: classes, data-slot, sizes, handle markup", async () => {
  const html = await renderToString(() => <Fixture />);
  const group = tag(html, "g");
  assert.match(group, /class="resizable rounded-lg border"/);
  assert.match(group, /data-slot="resizable-panel-group"/);
  assert.match(group, /flex-direction:\s*row/);
  const a = tag(html, "a");
  assert.match(a, /data-slot="resizable-panel"/);
  assert.match(a, /flex-basis:\s*25%/);
  assert.match(html, /<div class="resizable__panel p-4"/);
  const handle = tag(html, "h");
  assert.match(handle, /class="resizable__handle"/);
  assert.match(handle, /data-slot="resizable-handle"/);
  assert.match(handle, /role="separator"/);
  assert.match(handle, /aria-orientation="vertical"/);
  assert.doesNotMatch(html, /resizable__grip/);
});

test("resizable SSR: withHandle renders the grip (vertical grip in a horizontal group, horizontal grip in a vertical one)", async () => {
  const horizontal = await renderToString(() => <Fixture withHandle />);
  assert.match(horizontal, /class="resizable__grip" data-slot="resizable-handle-grip"/);
  // lucide GripVertical: dots in two columns (cx 9 / 15)
  assert.match(horizontal, /<circle cx="9" cy="5"/);
  const vertical = await renderToString(() => <Fixture withHandle orientation="vertical" />);
  assert.match(tag(vertical, "g"), /flex-direction:\s*column/);
  assert.match(tag(vertical, "h"), /aria-orientation="horizontal"/);
  // lucide GripHorizontal: dots in two rows (cy 9 / 15)
  assert.match(vertical, /<circle cx="5" cy="9"|<circle cx="12" cy="9"/);
});
