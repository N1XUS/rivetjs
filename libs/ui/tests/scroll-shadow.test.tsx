// DOM-target suite: `ScrollShadow` (upstream scroll-shadow.test.tsx ported; happy-dom has no layout, so the scroll metrics are
// stubbed as upstream does for jsdom): children, data-slot + BEM block, orientation / hideScrollBar modifiers, shadow mode
// (auto / manual when controlled or disabled), shadow state after content growth (MutationObserver), no measuring on an
// unrelated update, style variables + passed style, data attribute passthrough, visibility callback (none → bottom → both, no
// re-notify while unchanged, the newest callback); Rivet: every live prop updates the same container (node kept), controlled
// `visibility` attributes follow, a passed `ref` (callback / `ref()`) gets the element, live pass-through props (identifier spread).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
// The hook batches its DOM writes in a frame; node has no `requestAnimationFrame`.
const g = globalThis as Record<string, unknown>;
g.requestAnimationFrame ??= (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
g.cancelAnimationFrame ??= (id: number) => clearTimeout(id);

const { render } = await import("@rivetjs/runtime/testing");
const { ref } = await import("@rivetjs/runtime/dom");
const { signal } = await import("@rivetjs/reactivity");
const { ScrollShadow, ScrollShadowRoot, scrollShadowVariants } = await import("../src/components/scroll-shadow/index.ts");
const runtimeProps = await import("@rivetjs/runtime/props");
type Visibility = import("../src/components/scroll-shadow/index.ts").ScrollShadowVisibility;

/** happy-dom reports zero for every layout box, so the scroll metrics are stubbed. */
const stubScrollMetrics = (element: Element, metrics: Record<string, number>) => {
  for (const [property, value] of Object.entries(metrics)) Object.defineProperty(element, property, { configurable: true, value });
};

/** Client effects start in a microtask, the visibility writes run in a frame: drain a couple. */
const flushFrames = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

const scroller = (root: ParentNode) => root.querySelector<HTMLElement>("[data-slot=scroll-shadow]")!;
const scroll = (el: Element) => el.dispatchEvent(new window.Event("scroll") as unknown as Event);

test("scroll-shadow: renders children; data-slot and BEM block; compound static", () => {
  const r = render(() => <ScrollShadow>Scrollable content</ScrollShadow>);
  const el = scroller(r.container);
  assert.equal(el.textContent, "Scrollable content");
  assert.equal(el.tagName, "DIV");
  assert.equal(el.className, scrollShadowVariants().base());
  assert.match(el.className, /scroll-shadow/);
  assert.equal(el.getAttribute("data-orientation"), "vertical");
  assert.equal(ScrollShadow, ScrollShadowRoot);
  assert.equal(ScrollShadow.Root, ScrollShadowRoot);
  r.unmount();
});

test("scroll-shadow: orientation BEM modifier + data attribute; hideScrollBar modifier", () => {
  const r = render(() => (
    <>
      <ScrollShadow id="h" orientation="horizontal">
        Content
      </ScrollShadow>
      <ScrollShadow id="s" hideScrollBar>
        Content
      </ScrollShadow>
    </>
  ));
  const h = r.container.querySelector("#h")!;
  assert.equal(h.getAttribute("data-orientation"), "horizontal");
  assert.match(h.className, /scroll-shadow--horizontal/);
  assert.match(r.container.querySelector("#s")!.className, /scroll-shadow--hide-scrollbar/);
  r.unmount();
});

test("scroll-shadow: shadow mode auto; manual when visibility is controlled or detection is disabled", () => {
  const r = render(() => (
    <>
      <ScrollShadow id="a">Content</ScrollShadow>
      <ScrollShadow id="v" visibility="both">
        Content
      </ScrollShadow>
      <ScrollShadow id="d" isEnabled={false}>
        Content
      </ScrollShadow>
    </>
  ));
  assert.equal(r.container.querySelector("#a")!.getAttribute("data-scroll-shadow-mode"), "auto");
  assert.equal(r.container.querySelector("#v")!.getAttribute("data-scroll-shadow-mode"), "manual");
  assert.equal(r.container.querySelector("#d")!.getAttribute("data-scroll-shadow-mode"), "manual");
  r.unmount();
});

test("scroll-shadow: updates the shadow state when content resizes without a scroll or resize event", async () => {
  const rows = signal(1);
  const r = render(() => <ScrollShadow>{() => Array.from({ length: rows() }, (_, index) => <p>Row {index}</p>)}</ScrollShadow>);
  await flushFrames();
  const el = scroller(r.container);
  assert.equal(el.getAttribute("data-bottom-scroll"), "false");
  // A fixed-height container: its own box never changes and nothing scrolls. Only the content grew taller.
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
  rows.set(2);
  await flushFrames();
  assert.equal(el.getAttribute("data-bottom-scroll"), "true");
  assert.equal(el.getAttribute("data-top-scroll"), "false");
  r.unmount();
});

test("scroll-shadow: does not measure the container on an update that leaves the content alone", async () => {
  const count = signal(0);
  const r = render(() => (
    <>
      <span id="render-count">{count()}</span>
      <ScrollShadow>
        <p>Static content</p>
      </ScrollShadow>
    </>
  ));
  await flushFrames();
  const el = scroller(r.container);
  let scrollHeightReads = 0;
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get() {
      scrollHeightReads += 1;
      return 300;
    },
  });
  count.set(1);
  await flushFrames();
  assert.equal(r.container.querySelector("#render-count")!.textContent, "1");
  assert.equal(scrollHeightReads, 0);
  r.unmount();
});

test("scroll-shadow: keeps the shadow size and offset variables when a style prop is supplied; data attribute passthrough", () => {
  const r = render(() => (
    <ScrollShadow data-foo="bar" offset={20} size={64} style={{ height: "240px" }}>
      Content
    </ScrollShadow>
  ));
  const el = scroller(r.container);
  assert.equal(el.style.getPropertyValue("--scroll-shadow-size"), "64px");
  assert.equal(el.style.getPropertyValue("--scroll-shadow-offset"), "20px");
  assert.equal(el.style.height, "240px");
  assert.equal(el.getAttribute("data-scroll-shadow-size"), "64");
  assert.equal(el.getAttribute("data-foo"), "bar");
  r.unmount();
});

test("scroll-shadow: onVisibilityChange when the scroll state changes (none → bottom → both)", async () => {
  const calls: Visibility[] = [];
  const r = render(() => <ScrollShadow onVisibilityChange={(v: Visibility) => calls.push(v)}>Content</ScrollShadow>);
  await flushFrames();
  assert.deepEqual(calls, ["none"]);
  const el = scroller(r.container);
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
  scroll(el);
  await flushFrames();
  assert.equal(calls.at(-1), "bottom");
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 50 });
  scroll(el);
  await flushFrames();
  assert.equal(calls.at(-1), "both");
  assert.equal(el.getAttribute("data-top-bottom-scroll"), "true");
  assert.equal(el.hasAttribute("data-top-scroll"), false);
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
  scroll(el);
  await flushFrames();
  assert.equal(calls.at(-1), "top");
  assert.equal(el.getAttribute("data-top-scroll"), "true");
  assert.equal(el.getAttribute("data-bottom-scroll"), "false");
  r.unmount();
});

test("scroll-shadow: no re-notify while the scroll state is unchanged; the newest callback is called (live prop)", async () => {
  const first: Visibility[] = [];
  const second: Visibility[] = [];
  const which = signal(0);
  const r = render(() => (
    <ScrollShadow onVisibilityChange={which() === 0 ? (v: Visibility) => first.push(v) : (v: Visibility) => second.push(v)}>Content</ScrollShadow>
  ));
  await flushFrames();
  assert.deepEqual(first, ["none"]);
  which.set(1);
  which.set(2);
  await flushFrames();
  assert.deepEqual(first, ["none"], "swapping the callback does not re-subscribe / re-notify");
  assert.deepEqual(second, []);
  const el = scroller(r.container);
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
  scroll(el);
  await flushFrames();
  assert.deepEqual(second, ["bottom"]);
  assert.deepEqual(first, ["none"]);
  r.unmount();
});

test("scroll-shadow (Rivet): live orientation / size / offset / visibility / isEnabled / hideScrollBar update the same container", async () => {
  const orientation = signal<"vertical" | "horizontal">("vertical");
  const size = signal(40);
  const visibility = signal<Visibility>("auto");
  const enabled = signal(true);
  const hide = signal(false);
  const r = render(() => (
    <ScrollShadow orientation={orientation()} size={size()} offset={size() / 4} visibility={visibility()} isEnabled={enabled()} hideScrollBar={hide()}>
      <p id="child">Content</p>
    </ScrollShadow>
  ));
  await flushFrames();
  const el = scroller(r.container);
  const child = r.container.querySelector("#child");
  orientation.set("horizontal");
  assert.equal(el.getAttribute("data-orientation"), "horizontal");
  assert.match(el.className, /scroll-shadow--horizontal/);
  size.set(80);
  assert.equal(el.style.getPropertyValue("--scroll-shadow-size"), "80px");
  assert.equal(el.style.getPropertyValue("--scroll-shadow-offset"), "20px");
  assert.equal(el.getAttribute("data-scroll-shadow-size"), "80");
  hide.set(true);
  assert.match(el.className, /scroll-shadow--hide-scrollbar/);
  visibility.set("left");
  assert.equal(el.getAttribute("data-scroll-shadow-mode"), "manual");
  await flushFrames();
  assert.equal(el.getAttribute("data-left-scroll"), "true");
  visibility.set("both");
  await flushFrames();
  assert.equal(el.getAttribute("data-left-right-scroll"), "true");
  assert.equal(el.hasAttribute("data-left-scroll"), false);
  orientation.set("vertical");
  await flushFrames();
  assert.equal(el.getAttribute("data-top-bottom-scroll"), "true");
  assert.equal(el.hasAttribute("data-left-right-scroll"), false);
  visibility.set("auto");
  enabled.set(false);
  assert.equal(el.getAttribute("data-scroll-shadow-mode"), "manual");
  stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 0 });
  enabled.set(true);
  assert.equal(el.getAttribute("data-scroll-shadow-mode"), "auto");
  await flushFrames();
  assert.equal(el.getAttribute("data-bottom-scroll"), "true");
  assert.ok(scroller(r.container) === el, "container kept");
  assert.ok(r.container.querySelector("#child") === child, "children kept");
  r.unmount();
});

test("scroll-shadow (Rivet): disabled detection writes no state; a passed ref (callback / ref()) gets the element", async () => {
  const seen: Element[] = [];
  const signalRef = ref<HTMLDivElement>();
  const r = render(() => (
    <>
      <ScrollShadow id="off" isEnabled={false}>
        Content
      </ScrollShadow>
      <ScrollShadow id="cb" ref={(el: Element) => seen.push(el)}>
        Content
      </ScrollShadow>
      <ScrollShadow id="sig" ref={signalRef}>
        Content
      </ScrollShadow>
    </>
  ));
  await flushFrames();
  const off = r.container.querySelector("#off")!;
  assert.equal(off.hasAttribute("data-top-scroll"), false);
  assert.equal(off.hasAttribute("data-bottom-scroll"), false);
  assert.ok(seen.length === 1 && seen[0] === r.container.querySelector("#cb"), "callback ref");
  assert.ok(signalRef() === r.container.querySelector("#sig"), "ref() signal");
  r.unmount();
});

test("scroll-shadow clears automatic fades on disable, axis change and disposal", async () => {
  const enabled = signal(true);
  const orientation = signal<"vertical" | "horizontal">("vertical");
  const r = render(() => (
    <ScrollShadow isEnabled={enabled()} orientation={orientation()}>
      Content
    </ScrollShadow>
  ));
  const el = scroller(r.container);
  const keys = ["topScroll", "bottomScroll", "topBottomScroll", "leftScroll", "rightScroll", "leftRightScroll"];
  try {
    stubScrollMetrics(el, { clientHeight: 100, scrollHeight: 300, scrollTop: 50, clientWidth: 100, scrollWidth: 300, scrollLeft: 50 });
    await flushFrames();
    assert.equal(el.dataset.topBottomScroll, "true");
    enabled.set(false);
    await flushFrames();
    assert.ok(
      keys.every((key) => el.dataset[key] === undefined),
      "disabled auto mode has no stale fades",
    );
    enabled.set(true);
    await flushFrames();
    assert.equal(el.dataset.topBottomScroll, "true");
    orientation.set("horizontal");
    await flushFrames();
    assert.equal(el.dataset.topBottomScroll, undefined);
    assert.equal(el.dataset.leftRightScroll, "true");
  } finally {
    r.unmount();
  }
  assert.ok(
    keys.every((key) => el.dataset[key] === undefined),
    "cleanup removes owned attributes",
  );
});

test("scroll-shadow controlled fades survive detection toggles and clear when returning to auto", async () => {
  const enabled = signal(false);
  const visibility = signal<Visibility>("top");
  const r = render(() => (
    <ScrollShadow isEnabled={enabled()} visibility={visibility()}>
      Content
    </ScrollShadow>
  ));
  const el = scroller(r.container);
  try {
    await flushFrames();
    assert.equal(el.dataset.topScroll, "true");
    enabled.set(true);
    await flushFrames();
    assert.equal(el.dataset.topScroll, "true", "isEnabled controls automatic detection only");
    enabled.set(false);
    visibility.set("auto");
    await flushFrames();
    assert.equal(el.dataset.topScroll, undefined);
  } finally {
    r.unmount();
  }
});

test("scroll-shadow (Rivet): live pass-through props (id, aria-*, data-*, tabIndex) update the same container", () => {
  const n = signal(1);
  const r = render(() => (
    <ScrollShadow id={`s${n()}`} aria-label={`Feed ${n()}`} data-x={String(n())} tabIndex={n() > 1 ? 0 : -1}>
      Content
    </ScrollShadow>
  ));
  const el = scroller(r.container);
  for (const v of [2, 3, 1]) {
    n.set(v);
    assert.equal(el.id, `s${v}`);
    assert.equal(el.getAttribute("aria-label"), `Feed ${v}`);
    assert.equal(el.getAttribute("data-x"), String(v));
    assert.equal(el.getAttribute("tabindex"), v > 1 ? "0" : "-1");
    assert.equal(scroller(r.container), el);
  }
  r.unmount();
});

// A native-element spread of an identifier (`const [local, rest] = splitLive(…)`; `<div {...rest}>`) keeps the live getters
// (LIVE-PROPS P4: compiler `_spread(el, rest, 2)` / thunk).
test("live props: native-element identifier spread `{...rest}` keeps live getters", () => {
  const { splitProps } = runtimeProps;
  // Only static attributes besides the spread: a dynamic attribute would make the whole spread an effect.
  const Probe = (props: { label?: string; "data-x"?: string }) => {
    const [, rest] = splitProps(props as Record<string, unknown>, ["label"]);
    return (
      <div id="probe" {...rest}>
        x
      </div>
    );
  };
  const n = signal(1);
  const r = render(() => <Probe label="l" data-x={String(n())} />);
  const el = r.container.querySelector("#probe")!;
  n.set(2);
  assert.equal(el.getAttribute("data-x"), "2");
  r.unmount();
});
