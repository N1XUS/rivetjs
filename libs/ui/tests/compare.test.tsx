// DOM-target suite (happy-dom): `Compare` (Rivet-authored; HeroUI v3.2.6 / HeroUI Pro have no compare). Exports + slots;
// part classes over the cdk markup; keys move the divider (value, clip-path, onChange); a two-way Signal + a live
// accessor value; custom handle children replace the default divider + thumb; vertical thumb icon. Motion jumps here
// (happy-dom: `matchMedia` reduce stub); drags + the settle animation run in Chromium (cdk `compare.browser.test.tsx`,
// `tests-components/compare.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
(window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = (q: string) => ({ matches: q.includes("reduce") }) as never;
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (window as unknown as { matchMedia: unknown }).matchMedia;

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Compare, CompareRoot, compareVariants } = await import("../src/components/compare/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  );

test("compare: exports + slots", () => {
  assert.equal(Compare, CompareRoot);
  assert.equal(Compare.Root, CompareRoot);
  const s = compareVariants();
  assert.equal(s.base(), "compare");
  assert.equal(s.handle(), "compare__handle");
  assert.equal(s.thumb(), "compare__thumb");
  assert.equal(s.label({ class: "x" }), "compare__label x");
});

test("compare: classes, default handle, keys move the divider", async () => {
  const changes: number[] = [];
  const r = render(() => (
    <Compare id="c1" class="w-80" defaultValue={50} onChange={(v) => changes.push(v)}>
      <Compare.Before>A</Compare.Before>
      <Compare.After>B</Compare.After>
      <Compare.Handle />
    </Compare>
  ));
  const root = q("#c1")!;
  assert.equal(root.className, "compare w-80");
  assert.equal(root.getAttribute("data-slot"), "compare");
  assert.equal(q("#c1 [data-slot=compare-before]")!.className, "compare__before");
  const after = q("#c1 [data-slot=compare-after]")!;
  assert.equal(after.className, "compare__after");
  const handle = q("#c1 [role=slider]")!;
  assert.equal(handle.className, "compare__handle");
  assert.ok(q("#c1 .compare__divider"));
  assert.ok(q("#c1 .compare__thumb svg"));
  key(handle, "ArrowRight");
  await flush();
  assert.equal(handle.getAttribute("aria-valuenow"), "51");
  assert.match(after.getAttribute("style") ?? "", /clip-path: ?inset\(0(px)? 0(px)? 0(px)? 51%\)/);
  key(handle, "Home");
  await flush();
  assert.deepEqual(changes, [51, 0]);
  r.unmount();
});

test("compare: two-way Signal + live accessor value", async () => {
  const value = signal(20);
  const r = render(() => (
    <Compare id="c2" value={value}>
      <Compare.Before>A</Compare.Before>
      <Compare.After>B</Compare.After>
      <Compare.Handle />
    </Compare>
  ));
  key(q("#c2 [role=slider]")!, "End");
  await flush();
  assert.equal(value(), 100);
  value.set(42);
  await flush();
  assert.equal(q("#c2 [role=slider]")!.getAttribute("aria-valuenow"), "42");
  r.unmount();

  const outside = signal(10);
  const r2 = render(() => (
    <Compare id="c3" value={outside()} onChange={() => {}}>
      <Compare.Before>A</Compare.Before>
      <Compare.After>B</Compare.After>
      <Compare.Handle />
    </Compare>
  ));
  outside.set(65);
  await flush();
  assert.equal(q("#c3 [role=slider]")!.getAttribute("aria-valuenow"), "65");
  r2.unmount();
});

test("compare: custom handle children, vertical thumb icon, labels", () => {
  const r = render(() => (
    <Compare id="c4" orientation="vertical">
      <Compare.Before>
        A<Compare.Label>Before</Compare.Label>
      </Compare.Before>
      <Compare.After>
        B<Compare.Label placement="end">After</Compare.Label>
      </Compare.After>
      <Compare.Handle id="h-default" />
    </Compare>
  ));
  assert.equal(q("#h-default")!.getAttribute("aria-orientation"), "vertical");
  assert.ok(q("#h-default .compare__thumb svg.lucide-chevrons-up-down") || q("#h-default .compare__thumb svg"));
  const labels = document.querySelectorAll("#c4 [data-slot=compare-label]");
  assert.equal(labels.length, 2);
  assert.equal(labels[1]!.getAttribute("data-placement"), "end");
  assert.equal(labels[1]!.getAttribute("data-orientation"), "vertical");
  r.unmount();

  const r2 = render(() => (
    <Compare id="c5">
      <Compare.Before>A</Compare.Before>
      <Compare.After>B</Compare.After>
      <Compare.Handle>
        <span id="pill">Drag</span>
      </Compare.Handle>
    </Compare>
  ));
  assert.ok(q("#c5 #pill"));
  assert.equal(q("#c5 .compare__thumb"), null);
  r2.unmount();
});
