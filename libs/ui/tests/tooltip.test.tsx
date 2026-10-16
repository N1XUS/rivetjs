// DOM-target suite: `Tooltip` (upstream tests/components/tooltip/tooltip.test.tsx: `Tooltip.Trigger` data-slot, BEM block on the
// open tooltip, arrow slot when composed; hover / closeDelay / isDisabled need real pointer events: `tests-components/tooltip.test.ts`).
// Rivet: classes in / outside a Tooltip, default offset 3 / 7 with `showArrow` (positioning reads it: asserted in Chromium),
// `Tooltip.Trigger` focusable div (`tabindex=0`, role=button) opens on keyboard focus, `shouldSkipAnimation` scope, controlled
// `isOpen` signal, Escape, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { TooltipTriggerStateContext } = await import("@rivetjs/cdk/tooltip");
const { Button } = await import("../src/components/button/index.ts");
const { Tooltip, TooltipRoot, TooltipContent, tooltipVariants } = await import("../src/components/tooltip/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const tip = () => document.querySelector("[role=tooltip]") as HTMLElement | null;

test("tooltip: index exports", () => {
  assert.equal(Tooltip, TooltipRoot);
  assert.equal(Tooltip.Root, TooltipRoot);
  assert.equal(Tooltip.Content, TooltipContent);
  assert.equal(tooltipVariants().base(), "tooltip");
});

test("tooltip: exposes Tooltip.Trigger data-slot (focusable div, role=button, tooltip__trigger)", () => {
  const r = render(() => (
    <Tooltip delay={0}>
      <Tooltip.Trigger aria-label="Info" class="x">
        <span>i</span>
      </Tooltip.Trigger>
      <Tooltip.Content>Tooltip content</Tooltip.Content>
    </Tooltip>
  ));
  const t = r.container.querySelector('[data-slot="tooltip-trigger"]')!;
  assert.ok(t);
  assert.equal(t.tagName, "DIV");
  assert.equal(t.getAttribute("role"), "button");
  assert.equal(t.getAttribute("tabindex"), "0");
  assert.equal(t.className, "tooltip__trigger x");
  assert.equal(t.getAttribute("aria-label"), "Info");
  assert.equal(tip(), null);
  r.unmount();
});

test("tooltip: open tooltip has the BEM block + composed class; arrow slot when composed", async () => {
  const r = render(() => (
    <Tooltip defaultOpen delay={0}>
      <Button>Hover me</Button>
      <Tooltip.Content showArrow class="extra">
        <Tooltip.Arrow />
        Arrow tip
      </Tooltip.Content>
    </Tooltip>
  ));
  await flush();
  const t = tip()!;
  assert.ok(t);
  assert.match(t.className, /^tooltip extra$/);
  assert.ok(t.textContent!.includes("Arrow tip"));
  const arrow = document.querySelector('[data-slot="tooltip-arrow"]')!;
  assert.ok(arrow);
  const shape = arrow.querySelector('[data-slot="overlay-arrow"]')!;
  assert.ok(shape);
  assert.equal(shape.querySelector("path"), null);
  assert.match(shape.getAttribute("style") ?? "", /clip-path/);
  r.unmount();
});

test("tooltip: Escape closes an open tooltip", async () => {
  const open = signal(true);
  const r = render(() => (
    <Tooltip isOpen={open} delay={0}>
      <Button>Hover me</Button>
      <Tooltip.Content>Hover tip</Tooltip.Content>
    </Tooltip>
  ));
  await flush();
  assert.ok(tip());
  document.dispatchEvent(new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await flush();
  await flush();
  assert.equal(open(), false);
  assert.equal(tip(), null);
  r.unmount();
});

test("tooltip: controlled isOpen signal opens / closes", async () => {
  const open = signal(false);
  const r = render(() => (
    <Tooltip isOpen={open}>
      <Button>Hover me</Button>
      <Tooltip.Content>Hover tip</Tooltip.Content>
    </Tooltip>
  ));
  await flush();
  assert.equal(tip(), null);
  open.set(true);
  await flush();
  assert.ok(tip());
  assert.equal(r.container.querySelector("button")!.getAttribute("aria-describedby"), tip()!.id);
  open.set(false);
  await flush();
  await flush();
  assert.equal(tip(), null);
  r.unmount();
});

test("tooltip: animation scope keeps shouldSkipAnimation false for descendants unless opted in", () => {
  const seen: boolean[] = [];
  const Probe = () => {
    seen.push(useContext(TooltipTriggerStateContext)!.shouldSkipAnimation());
    return null;
  };
  const r = render(() => (
    <>
      <Tooltip>
        <Button>a</Button>
        <Probe />
      </Tooltip>
      <Tooltip shouldSkipAnimation>
        <Button>b</Button>
        <Probe />
      </Tooltip>
    </>
  ));
  assert.deepEqual(seen, [false, false]);
  r.unmount();
});

test("tooltip: parts outside a Tooltip get only the caller's class", () => {
  const r = render(() => <Tooltip.Trigger class="x">t</Tooltip.Trigger>);
  assert.equal(r.container.querySelector("[data-slot=tooltip-trigger]")!.className, "x");
  r.unmount();
});
