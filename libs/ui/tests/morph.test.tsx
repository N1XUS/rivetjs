// DOM-target suite (happy-dom): `Morph` (Rivet-authored; feature set inspired by HeroUI Pro's public MorphButton docs).
// Exports + variants; part classes / slots; a press on the collapsed content opens (state, `data-open`, `inert` swap,
// `aria-expanded`, `onOpenChange`), Close collapses + returns focus to the trigger, Escape closes, `isDisabled` ignores the
// press, `useMorph` actions, controlled two-way Signal; motion jumps here (happy-dom: `matchMedia` reduce stub).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
// happy-dom runs no layout: jump every morph (the motion itself is covered in Chromium, tests-components/morph.test.ts).
(window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = (q: string) => ({ matches: q.includes("reduce") }) as never;
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (window as unknown as { matchMedia: unknown }).matchMedia;

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Morph, MorphRoot, morphVariants, useMorph } = await import("../src/components/morph/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 30));
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  );

test("morph: exports + variants", () => {
  assert.equal(Morph, MorphRoot);
  assert.equal(Morph.Root, MorphRoot);
  assert.equal(morphVariants().base(), "morph morph--top morph--primary");
  assert.equal(morphVariants({ direction: "start", variant: "secondary" }).base(), "morph morph--start morph--secondary");
  assert.equal(morphVariants().surface(), "morph__surface");
  assert.equal(morphVariants().expanded(), "morph__expanded");
});

test("morph: press opens, Close collapses + focus back, Escape closes, onOpenChange", async () => {
  const changes: boolean[] = [];
  const r = render(() => (
    <Morph id="m1" onOpenChange={(o) => changes.push(o)}>
      <Morph.CollapsedContent class="c">
        Bag
        <Morph.Trigger id="m1-view">View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent aria-label="Summary" class="w-80">
        <Morph.Close id="m1-close">Keep shopping</Morph.Close>
      </Morph.ExpandedContent>
    </Morph>
  ));
  const root = q("#m1")!;
  assert.equal(root.className, "morph morph--top morph--primary");
  assert.equal(q("#m1 [data-slot=morph-collapsed]")!.className, "morph__collapsed c");
  assert.equal(q("#m1-panel")!.getAttribute("role"), "dialog");
  q("#m1-view")!.click();
  await flush();
  assert.equal(root.hasAttribute("data-open"), true);
  assert.equal(q("#m1-view")!.getAttribute("aria-expanded"), "true");
  assert.equal((q("#m1-panel") as HTMLElement & { inert: boolean }).inert, false);
  assert.equal((q("#m1 [data-slot=morph-collapsed]") as HTMLElement & { inert: boolean }).inert, true);
  assert.deepEqual(changes, [true]);
  q("#m1-close")!.click();
  await flush();
  assert.equal(root.hasAttribute("data-open"), false);
  assert.equal(document.activeElement?.id, "m1-view");
  assert.deepEqual(changes, [true, false]);
  q("#m1-view")!.click();
  await flush();
  key(q("#m1-panel")!, "Escape");
  await flush();
  assert.equal(root.hasAttribute("data-open"), false);
  assert.deepEqual(changes, [true, false, true, false]);
  r.unmount();
});

test("morph: isDisabled ignores the press", async () => {
  const r = render(() => (
    <Morph id="m2" isDisabled>
      <Morph.CollapsedContent>
        <Morph.Trigger id="m2-view">View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent>x</Morph.ExpandedContent>
    </Morph>
  ));
  q("#m2 [data-slot=morph-collapsed]")!.click();
  await flush();
  assert.equal(q("#m2")!.hasAttribute("data-open"), false);
  r.unmount();
});

test("morph: useMorph actions + controlled Signal", async () => {
  const open = signal(false);
  const Inner = () => {
    const m = useMorph();
    return (
      <button id="m3-toggle" type="button" onClick={() => m.toggle()}>
        {m.isOpen() ? "on" : "off"}
      </button>
    );
  };
  const r = render(() => (
    <Morph id="m3" isOpen={open}>
      <Morph.CollapsedContent>
        <Morph.Trigger>View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent>
        <p>x</p>
      </Morph.ExpandedContent>
      <Inner />
    </Morph>
  ));
  q("#m3-toggle")!.click();
  await flush();
  assert.equal(open(), true);
  assert.equal(q("#m3")!.hasAttribute("data-open"), true);
  assert.equal(q("#m3-toggle")!.textContent, "on");
  open.set(false);
  await flush();
  assert.equal(q("#m3")!.hasAttribute("data-open"), false);
  r.unmount();
});
