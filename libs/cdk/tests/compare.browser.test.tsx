// Behaviour tests (Chromium, real layout + rAF) for the Rivet-authored `@rivetjs/cdk/compare`: slider ARIA, keyboard
// steps (step grid, Shift / Page, Home / End), animated settle (Motion1D frames, `data-moving`, value committed at once),
// `animation={false}` + reduced motion jump, handle drag (grab offset kept, 1:1, onChange per move, onChangeEnd once),
// `dragAnywhere` surface press (animated jump + drag), RTL (keys + pointer + clip side), vertical, controlled two-way
// Signal + live accessor value, `isDisabled` (static + live), focus-visible only from the keyboard.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle, type CompareProps } from "../compare/index.tsx";

afterEach(cleanup);

const CSS =
  ".rv-Compare{width:200px;height:100px;margin:0}.rv-CompareBefore,.rv-CompareAfter{height:100px}" +
  ".rv-CompareHandle[aria-orientation=horizontal]{width:20px}.rv-CompareHandle[aria-orientation=vertical]{height:20px}" +
  ".rv-Compare[data-orientation=vertical]{width:100px;height:200px}.rv-Compare[data-orientation=vertical] .rv-CompareBefore{height:200px}";
let style: HTMLStyleElement | undefined;
function mount(ui: () => unknown): HTMLElement {
  if (!style) {
    style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
  }
  return render(ui as never).container as HTMLElement;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await sleep(16);
  }
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
const pointer = (target: EventTarget, type: string, x: number, y: number, pointerType = "mouse") =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );

function Fixture(props: CompareProps & { label?: string }) {
  // Spread, not a rest destructure: a destructure would snapshot live props.
  return (
    <Compare id="cmp" {...props}>
      <CompareBefore>
        <div id="before">Before</div>
      </CompareBefore>
      <CompareAfter>
        <div id="after">After</div>
      </CompareAfter>
      <CompareHandle aria-label={props.label}>
        <CompareDivider />
      </CompareHandle>
    </Compare>
  );
}

const parts = (c: HTMLElement) => ({
  root: c.querySelector("[data-rv-compare]") as HTMLElement,
  after: c.querySelector("[data-rv-compare-after]") as HTMLElement,
  handle: c.querySelector("[role=slider]") as HTMLElement,
});
const now = (h: HTMLElement) => Number(h.getAttribute("aria-valuenow"));
const left = (h: HTMLElement) => parseFloat(h.style.left);
const rest = (root: HTMLElement) => until(() => !root.hasAttribute("data-moving"));

describe("Compare", () => {
  it("is a labelled slider with value / text / range; layers stacked and clipped", () => {
    const c = mount(() => <Fixture defaultValue={30} />);
    const { root, after, handle } = parts(c);
    expect(handle.getAttribute("aria-label")).toBe("Comparison position");
    expect(handle.getAttribute("aria-valuenow")).toBe("30");
    expect(handle.getAttribute("aria-valuetext")).toBe("30%");
    expect(handle.getAttribute("aria-valuemin")).toBe("0");
    expect(handle.getAttribute("aria-valuemax")).toBe("100");
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    expect(handle.tabIndex).toBe(0);
    expect(root.style.position).toBe("relative");
    expect(root.style.getPropertyValue("--rv-compare-position")).toBe("30%");
    expect(after.style.position).toBe("absolute");
    expect(after.style.clipPath).toBe("inset(0px 0px 0px 30%)");
    const r = root.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    expect(Math.round(h.left + h.width / 2 - r.left)).toBe(60);
    expect(Math.round(h.height)).toBe(100);
    expect(c.querySelector(".rv-CompareDivider")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keys step on the grid, Shift / Page by 10, Home / End; onChange + onChangeEnd once per key; animated settle", async () => {
    const changes: number[] = [];
    const ends: number[] = [];
    const c = mount(() => <Fixture defaultValue={50} onChange={(v) => changes.push(v)} onChangeEnd={(v) => ends.push(v)} />);
    const { root, handle } = parts(c);
    handle.focus();
    key(handle, "ArrowRight");
    expect(now(handle)).toBe(51);
    // Animated: the rendered position glides (frames between 50 and 51).
    expect(root.hasAttribute("data-moving")).toBe(true);
    await rest(root);
    expect(left(handle)).toBe(51);
    key(handle, "ArrowLeft", { shiftKey: true });
    expect(now(handle)).toBe(41);
    const frames: number[] = [];
    await until(() => {
      frames.push(left(handle));
      return !root.hasAttribute("data-moving");
    });
    expect(frames.some((f) => f > 41.05 && f < 50.95)).toBe(true);
    key(handle, "PageUp");
    expect(now(handle)).toBe(51);
    key(handle, "End");
    expect(now(handle)).toBe(100);
    key(handle, "Home");
    expect(now(handle)).toBe(0);
    key(handle, "ArrowLeft");
    expect(now(handle)).toBe(0);
    key(handle, "ArrowUp");
    expect(now(handle)).toBe(1);
    expect(changes).toEqual([51, 41, 51, 100, 0, 1]);
    expect(ends).toEqual([51, 41, 51, 100, 0, 1]);
    await rest(root);
    expect(left(handle)).toBe(1);
  });

  it("animation={false} and reduced motion jump", async () => {
    const c = mount(() => <Fixture defaultValue={50} animation={false} />);
    const { root, handle } = parts(c);
    key(handle, "End");
    expect(root.hasAttribute("data-moving")).toBe(false);
    expect(left(handle)).toBe(100);
    cleanup();
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q }) as MediaQueryList) as typeof window.matchMedia;
    try {
      const c2 = mount(() => <Fixture defaultValue={50} />);
      const p = parts(c2);
      key(p.handle, "Home");
      expect(p.root.hasAttribute("data-moving")).toBe(false);
      expect(left(p.handle)).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });

  it("dragging the handle keeps the grab offset and follows 1:1; onChangeEnd once on release", async () => {
    const changes: number[] = [];
    const ends: number[] = [];
    const c = mount(() => <Fixture defaultValue={50} onChange={(v) => changes.push(v)} onChangeEnd={(v) => ends.push(v)} />);
    const { root, handle } = parts(c);
    const r = root.getBoundingClientRect();
    const y = r.top + 50;
    // Grab 6 px right of the divider: no jump.
    pointer(handle, "pointerdown", r.left + 106, y);
    expect(now(handle)).toBe(50);
    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(handle.getAttribute("data-dragging")).toBe("true");
    expect(document.activeElement).toBe(handle);
    expect(handle.hasAttribute("data-focus-visible")).toBe(false);
    pointer(window, "pointermove", r.left + 146, y);
    expect(now(handle)).toBe(70);
    expect(left(handle)).toBe(70);
    expect(root.hasAttribute("data-moving")).toBe(false);
    pointer(window, "pointermove", r.left + 400, y);
    expect(now(handle)).toBe(100);
    pointer(window, "pointermove", r.left + 37, y);
    expect(changes.at(-1)).toBeCloseTo(15.5, 5);
    pointer(window, "pointerup", r.left + 37, y);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(ends).toEqual([15.5]);
    // Moves after release do nothing.
    pointer(window, "pointermove", r.left + 150, y);
    expect(now(handle)).toBe(16);
  });

  it("a surface press does nothing by default; dragAnywhere jumps there (animated) and drags", async () => {
    const c = mount(() => <Fixture defaultValue={50} />);
    const { root, handle } = parts(c);
    const r = root.getBoundingClientRect();
    pointer(c.querySelector("#before")!, "pointerdown", r.left + 20, r.top + 50);
    pointer(window, "pointerup", r.left + 20, r.top + 50);
    expect(now(handle)).toBe(50);
    cleanup();

    const ends: number[] = [];
    const c2 = mount(() => <Fixture defaultValue={50} dragAnywhere onChangeEnd={(v) => ends.push(v)} />);
    const p = parts(c2);
    const r2 = p.root.getBoundingClientRect();
    expect(p.root.style.touchAction).toBe("pan-y");
    pointer(c2.querySelector("#after")!, "pointerdown", r2.left + 180, r2.top + 50);
    expect(now(p.handle)).toBe(90);
    expect(p.root.hasAttribute("data-moving")).toBe(true);
    expect(document.activeElement).toBe(p.handle);
    // Drag while the jump settles: retargeted (continuous), then 1:1.
    pointer(window, "pointermove", r2.left + 160, r2.top + 50);
    expect(now(p.handle)).toBe(80);
    await rest(p.root);
    expect(left(p.handle)).toBe(80);
    pointer(window, "pointermove", r2.left + 140, r2.top + 50);
    expect(left(p.handle)).toBe(70);
    pointer(window, "pointerup", r2.left + 140, r2.top + 50);
    expect(ends).toEqual([70]);
  });

  it("RTL: start edge on the right — clip side, pointer and keys mirror", async () => {
    const c = mount(() => (
      <I18nProvider locale="he-IL">
        <Fixture defaultValue={25} animation={false} />
      </I18nProvider>
    ));
    const { root, after, handle } = parts(c);
    expect(after.style.clipPath).toBe("inset(0px 25% 0px 0px)");
    expect(handle.style.right).toBe("25%");
    const r = root.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    expect(Math.round(r.right - (h.left + h.width / 2))).toBe(50);
    key(handle, "ArrowLeft");
    expect(now(handle)).toBe(26);
    key(handle, "ArrowRight");
    expect(now(handle)).toBe(25);
    pointer(handle, "pointerdown", r.right - 50, r.top + 50);
    pointer(window, "pointermove", r.right - 100, r.top + 50);
    expect(now(handle)).toBe(50);
    pointer(window, "pointerup", r.right - 100, r.top + 50);
  });

  it("vertical: top inset, keys follow the divider spatially, pointer on the y axis", () => {
    const c = mount(() => <Fixture defaultValue={40} orientation="vertical" animation={false} />);
    const { root, after, handle } = parts(c);
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(root.getAttribute("data-orientation")).toBe("vertical");
    expect(after.style.clipPath).toBe("inset(40% 0px 0px)");
    expect(handle.style.top).toBe("40%");
    key(handle, "ArrowDown");
    expect(now(handle)).toBe(41);
    key(handle, "ArrowUp");
    expect(now(handle)).toBe(40);
    key(handle, "PageDown");
    expect(now(handle)).toBe(50);
    const r = root.getBoundingClientRect();
    pointer(handle, "pointerdown", r.left + 50, r.top + 100);
    pointer(window, "pointermove", r.left + 50, r.top + 150);
    expect(now(handle)).toBe(75);
    pointer(window, "pointerup", r.left + 50, r.top + 150);
  });

  it("controlled: a two-way Signal follows both ways; a live accessor value moves the divider", async () => {
    const value = signal(20);
    const c = mount(() => <Fixture value={value} animation={false} />);
    const { handle } = parts(c);
    key(handle, "ArrowRight");
    expect(value()).toBe(21);
    value.set(64);
    await flush();
    expect(now(handle)).toBe(64);
    expect(left(handle)).toBe(64);
    cleanup();

    const outside = signal(10);
    const seen: number[] = [];
    const c2 = mount(() => <Fixture value={outside()} onChange={(v) => seen.push(v)} animation={false} />);
    const p = parts(c2);
    expect(now(p.handle)).toBe(10);
    outside.set(35);
    await flush();
    expect(now(p.handle)).toBe(35);
    expect(p.after.style.clipPath).toBe("inset(0px 0px 0px 35%)");
    key(p.handle, "End");
    expect(seen).toEqual([100]);
    // Read-only accessor: the caller decides.
    expect(now(p.handle)).toBe(35);
  });

  it("isDisabled (static + live) ignores keys and pointers, removes the tab stop", async () => {
    const c = mount(() => <Fixture defaultValue={50} isDisabled />);
    const { root, handle } = parts(c);
    expect(handle.getAttribute("aria-disabled")).toBe("true");
    expect(handle.hasAttribute("tabindex")).toBe(false);
    expect(root.getAttribute("data-disabled")).toBe("true");
    key(handle, "End");
    pointer(handle, "pointerdown", 0, 0);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(now(handle)).toBe(50);
    cleanup();

    const off = signal(true);
    const c2 = mount(() => <Fixture defaultValue={50} isDisabled={off()} animation={false} />);
    const p = parts(c2);
    key(p.handle, "End");
    expect(now(p.handle)).toBe(50);
    off.set(false);
    await flush();
    expect(p.handle.tabIndex).toBe(0);
    expect(p.handle.hasAttribute("aria-disabled")).toBe(false);
    key(p.handle, "End");
    expect(now(p.handle)).toBe(100);
  });

  it("focus-visible from the keyboard only; custom aria-label", async () => {
    const c = mount(() => (
      <>
        <button id="before-btn">x</button>
        <Fixture defaultValue={50} label="Photo split" />
      </>
    ));
    const { handle } = parts(c);
    expect(handle.getAttribute("aria-label")).toBe("Photo split");
    const btn = c.querySelector("#before-btn") as HTMLElement;
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    handle.focus();
    await flush();
    expect(handle.getAttribute("data-focus-visible")).toBe("true");
  });
});
