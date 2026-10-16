// T13: `/animate` (refs, accessors, arrays, sequences, controls), `/scroll` (accessors, target progress,
// ScrollTimeline), `/in-view` (once), `/reduced-motion` (live media query).
import { afterEach, expect, test, vi } from "vitest";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { animate } from "@rivetjs/motion/animate";
import { createScroll, scrollAnimation } from "@rivetjs/motion/scroll";
import { createInView } from "@rivetjs/motion/in-view";

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
});
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const byId = (id: string) => document.getElementById(id)!;

test("animate: ref(), accessors and arrays as targets; controls pause / time / finished", async () => {
  const a = ref<HTMLDivElement>();
  render(() => (
    <div>
      <div id="a" ref={a} />
      <div id="b" />
      <div id="c" />
    </div>
  ));
  const controls = animate([a, () => byId("b"), byId("c")], { opacity: [1, 0.5] }, { duration: 0.2, ease: "linear" });
  controls.pause();
  controls.time = 0.1;
  await frame();
  for (const id of ["a", "b", "c"]) expect(Number(getComputedStyle(byId(id)).opacity)).toBeCloseTo(0.75, 1);
  controls.play();
  await controls.finished;
  expect(getComputedStyle(byId("a")).opacity).toBe("0.5");
});

test("animate: a sequence with `at` maps its segment targets", async () => {
  const a = ref<HTMLDivElement>();
  render(() => (
    <div>
      <div id="a" ref={a} />
      <div id="b" />
    </div>
  ));
  const controls = animate([
    [a, { opacity: 0.2 }, { duration: 0.1 }],
    [() => byId("b"), { opacity: 0.4 }, { duration: 0.1, at: 0 }],
  ]);
  await controls;
  expect(getComputedStyle(byId("a")).opacity).toBe("0.2");
  expect(getComputedStyle(byId("b")).opacity).toBe("0.4");
});

test("createScroll: window accessors update; target progress", async () => {
  let values!: ReturnType<typeof createScroll>;
  let tracked!: ReturnType<typeof createScroll>;
  const target = ref<HTMLDivElement>();
  render(() => {
    values = createScroll();
    tracked = createScroll({ target, offset: ["start end", "end start"] });
    return (
      <div style={{ height: "4000px" }}>
        <div style={{ height: "1500px" }} />
        <div id="t" ref={target} style={{ height: "200px" }} />
      </div>
    );
  });
  expect(values.y()).toBe(0);
  await frame();
  window.scrollTo(0, 1000);
  await vi.waitUntil(() => values.y() === 1000, { timeout: 2000, interval: 16 });
  expect(values.yProgress()).toBeGreaterThan(0);
  await vi.waitUntil(() => tracked.yProgress() > 0, { timeout: 2000, interval: 16 });
  expect(tracked.yProgress()).toBeLessThan(1);
});

test("createScroll: a container's scroll", async () => {
  let values!: ReturnType<typeof createScroll>;
  const box = ref<HTMLDivElement>();
  render(() => {
    values = createScroll({ container: box });
    return (
      <div id="box" ref={box} style={{ height: "100px", overflow: "auto" }}>
        <div style={{ height: "1000px" }} />
      </div>
    );
  });
  await frame();
  byId("box").scrollTop = 450;
  await vi.waitUntil(() => values.y() === 450, { timeout: 2000, interval: 16 });
  expect(values.yProgress()).toBeCloseTo(0.5, 1);
});

test("scrollAnimation: a native ScrollTimeline drives the animation", async () => {
  const el = ref<HTMLDivElement>();
  render(() => {
    scrollAnimation(el, { opacity: [0, 1] });
    return (
      <div style={{ height: "3000px" }}>
        <div id="s" ref={el} style={{ position: "fixed", top: "0", width: "10px", height: "10px" }} />
      </div>
    );
  });
  await vi.waitUntil(() => byId("s").getAnimations().length > 0, { timeout: 2000, interval: 16 });
  const timeline = byId("s").getAnimations()[0]!.timeline;
  const Native = (globalThis as { ScrollTimeline?: new () => AnimationTimeline }).ScrollTimeline;
  expect(!!Native && timeline instanceof Native).toBe(true);
});

test("createInView once: flips to true once, stays after leaving", async () => {
  let seen!: () => boolean;
  const el = ref<HTMLDivElement>();
  render(() => {
    seen = createInView(el, { once: true });
    return (
      <div style={{ height: "4000px" }}>
        <div style={{ height: "2500px" }} />
        <div id="v" ref={el} style={{ height: "50px" }} />
      </div>
    );
  });
  await frame();
  expect(seen()).toBe(false);
  byId("v").scrollIntoView();
  await vi.waitUntil(() => seen(), { timeout: 2000, interval: 16 });
  window.scrollTo(0, 0);
  await frame();
  await frame();
  expect(seen()).toBe(true);
});

test("prefersReducedMotion follows the media query", async () => {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  vi.spyOn(window, "matchMedia").mockImplementation(
    () => ({ matches: false, addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => listeners.push(fn) }) as never,
  );
  vi.resetModules();
  const { prefersReducedMotion } = await import("@rivetjs/motion/reduced-motion");
  const reduced = prefersReducedMotion();
  expect(reduced()).toBe(false);
  for (const fn of listeners) fn({ matches: true });
  expect(reduced()).toBe(true);
  vi.restoreAllMocks();
});
