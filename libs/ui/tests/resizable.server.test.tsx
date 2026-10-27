// Server-target suite: `Resizable` (Rivet addition: shadcn/ui Resizable API on react-resizable-panels behaviour from
// `@rivetjs/cdk/resizable`, HeroUI look) SSR — BEM classes + shadcn `data-slot`s on group / panel / handle, `class` merged
// (panel class on the inner element), panel sizes from the first byte (cdk inline flex styles), `withHandle` grip with the
// lucide grip for the group's axis, index exports + compound parts; handle `type` / `variant` / `withIndicator` and
// `ResizableIndicator` (UI-PORT-C: names from HeroUI Pro's public Resizable docs, independent implementation).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Resizable, ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup, resizableVariants } from "../index.ts";

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
  assert.equal(Resizable.Indicator, ResizableIndicator);
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
  assert.match(handle, /class="resizable__handle resizable__handle--line resizable__handle--primary"/);
  assert.match(handle, /data-type="line"/);
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

type HandleType = "line" | "drag" | "pill" | "handle";
const Typed = (props: { type?: HandleType; variant?: "primary" | "secondary" | "tertiary"; withIndicator?: boolean; orientation?: "vertical" }) => (
  <ResizablePanelGroup id="g" orientation={props.orientation}>
    <ResizablePanel id="a">one</ResizablePanel>
    <ResizableHandle id="h" type={props.type} variant={props.variant} withIndicator={props.withIndicator} />
    <ResizablePanel id="b">two</ResizablePanel>
  </ResizablePanelGroup>
);
const handleOf = (html: string) => html.slice(html.indexOf('id="h"') - 200, html.indexOf("<div data-panel", html.indexOf('id="h"')));

test("resizable SSR: handle types (line = bare, drag = grip chip, pill / handle = pill indicator)", async () => {
  const line = handleOf(await renderToString(() => <Typed />));
  assert.doesNotMatch(line, /resizable__indicator|resizable__grip/);
  const drag = handleOf(await renderToString(() => <Typed type="drag" />));
  assert.match(drag, /resizable__handle--drag/);
  assert.match(drag, /data-type="drag"/);
  assert.match(drag, /class="resizable__grip" data-slot="resizable-handle-grip"/);
  for (const type of ["pill", "handle"] as const) {
    const html = handleOf(await renderToString(() => <Typed type={type} />));
    assert.match(html, new RegExp(`resizable__handle--${type}`));
    assert.match(html, /<div class="resizable__indicator resizable__indicator--pill" data-slot="resizable-indicator" data-type="pill" aria-hidden="true">/);
    assert.doesNotMatch(html, /<svg/);
  }
});

test("resizable SSR: withIndicator = drag dots on a line; withHandle = the drag chip", async () => {
  const html = handleOf(await renderToString(() => <Typed withIndicator />));
  assert.match(html, /resizable__handle--line/);
  assert.match(html, /class="resizable__indicator resizable__indicator--drag" data-slot="resizable-indicator" data-type="drag"/);
  assert.match(html, /<circle cx="9" cy="5"/);
  const vertical = handleOf(await renderToString(() => <Typed withIndicator orientation="vertical" />));
  assert.match(vertical, /<circle cx="5" cy="9"|<circle cx="12" cy="9"/);
  const chip = await renderToString(() => (
    <ResizablePanelGroup>
      <ResizablePanel id="a">a</ResizablePanel>
      <ResizableHandle id="h" withHandle />
      <ResizablePanel id="b">b</ResizablePanel>
    </ResizablePanelGroup>
  ));
  assert.match(chip, /resizable__handle--drag/);
});

test("resizable SSR: variants map to separator token classes", async () => {
  for (const variant of ["primary", "secondary", "tertiary"] as const) {
    const html = handleOf(await renderToString(() => <Typed variant={variant} />));
    assert.match(html, new RegExp(`class="resizable__handle resizable__handle--line resizable__handle--${variant}"`));
  }
});

test("resizable SSR: a composed ResizableIndicator (custom children replace the affordance)", async () => {
  const html = await renderToString(() => (
    <ResizablePanelGroup>
      <ResizablePanel id="a">a</ResizablePanel>
      <ResizableHandle id="h">
        <ResizableIndicator type="drag" class="opacity-50" />
      </ResizableHandle>
      <ResizablePanel id="b">b</ResizablePanel>
      <ResizableHandle id="h2">
        <ResizableIndicator>
          <span id="custom">Move</span>
        </ResizableIndicator>
      </ResizableHandle>
      <ResizablePanel id="c">c</ResizablePanel>
    </ResizablePanelGroup>
  ));
  assert.match(html, /class="resizable__indicator resizable__indicator--drag opacity-50"/);
  assert.match(html, /resizable__indicator--pill" data-slot="resizable-indicator" data-type="pill" aria-hidden="true"><span id="custom">/);
});
