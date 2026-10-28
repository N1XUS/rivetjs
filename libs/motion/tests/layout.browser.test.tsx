// T12: `@rivetjs/motion/layout` on the shared FLIP core: animateLayout (Motion's vanilla signature), layoutId shared
// elements across a swap (tabs underline), layoutDriver for cdk Masonry, reduced motion.
import { afterEach, expect, test, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Motion } from "@rivetjs/motion";
import { animateLayout, LayoutGroup, layoutDriver } from "@rivetjs/motion/layout";
import { Masonry } from "@rivetjs/cdk/masonry";
import { layoutHook } from "../layout-hook.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const byId = (id: string) => document.getElementById(id)!;
const left = (id: string) => byId(id).getBoundingClientRect().left;

test("layoutId: a disposed probe does not play its queued layout animation", () => {
  const queued: VoidFunction[] = [];
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((run) => void queued.push(run));
  vi.spyOn(layoutHook, "from").mockReturnValue(new DOMRect(0, 0, 100, 2));
  const play = vi.spyOn(layoutHook, "play");
  // Derived adoption disposes the detached probe before its mount microtask runs, clearing its ref.
  render(() => <Motion.div layoutId="probe-underline" />);
  cleanup();
  for (const run of queued) run();
  expect(play).not.toHaveBeenCalled();
});

test("animateLayout: a `layout` child animates from its old box (midway between old and new)", async () => {
  const justify = signal("flex-start");
  render(() => (
    <div id="row" style={{ display: "flex", width: "400px", "justify-content": justify() }}>
      <Motion.div id="box" layout style={{ width: "50px", height: "50px" }} />
    </div>
  ));
  const row = byId("row");
  expect(byId("box").getAttribute("data-layout")).toBe("true");
  const start = left("box") - row.getBoundingClientRect().left;
  const result = await animateLayout(row, () => justify.set("flex-end"), { duration: 0.3, ease: "linear" });
  await frame();
  await frame();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const mid = left("box") - row.getBoundingClientRect().left;
  expect(start).toBe(0);
  expect(mid).toBeGreaterThan(20);
  expect(mid).toBeLessThan(330);
  await result.finished;
  expect(left("box") - row.getBoundingClientRect().left).toBe(350);
  expect(byId("box").style.transform).toBe("");
});

test("animateLayout layout='size': only the size animates", async () => {
  const wide = signal(false);
  render(() => (
    <div id="row" style={{ display: "flex", width: "400px", "justify-content": wide() ? "flex-end" : "flex-start" }}>
      <Motion.div id="box" layout="size" style={{ width: wide() ? "200px" : "50px", height: "50px" }} />
    </div>
  ));
  const result = await animateLayout(byId("row"), () => wide.set(true), { duration: 0.3, ease: "linear" });
  await frame();
  await frame();
  const box = byId("box").getBoundingClientRect();
  expect(box.left - byId("row").getBoundingClientRect().left).toBeGreaterThan(190);
  expect(box.width).toBeLessThan(200);
  await result.finished;
});

test("layoutId: the new element of a swap starts at the old one's box (tabs underline)", async () => {
  const tab = signal(0);
  render(() => (
    <LayoutGroup id="tabs">
      <div style={{ display: "flex", width: "300px" }}>
        {[0, 1, 2].map((i) => (
          <div id={"t" + i} style={{ width: "100px", height: "20px", position: "relative" }}>
            {tab() === i ? (
              <Motion.div
                id={"u" + i}
                layoutId="underline"
                transition={{ duration: 0.3, ease: "linear" }}
                style={{ position: "absolute", left: "0", bottom: "0", width: "100px", height: "2px" }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </LayoutGroup>
  ));
  expect(byId("u0").getAttribute("data-layout-id")).toBe("tabs-underline");
  const from = left("u0");
  tab.set(2);
  await frame();
  await frame();
  const now = left("u2");
  expect(now).toBeGreaterThan(from);
  expect(now).toBeLessThan(left("t2"));
  await vi.waitUntil(() => byId("u2").getAnimations().length === 0, { timeout: 2000, interval: 16 });
  expect(left("u2")).toBe(left("t2"));
});

test("layoutDriver drives a cdk Masonry relayout on WAAPI", async () => {
  const expanded = signal<string | null>(null);
  const items = Array.from({ length: 9 }, (_, i) => ({ id: "p" + i, aspectRatio: [1, 0.66, 1.5][i % 3]! }));
  render(() => (
    <div style={{ width: "620px" }}>
      <Masonry
        items={items}
        columns={3}
        gap={10}
        aria-label="Flip"
        motion={layoutDriver({ duration: 0.3 })}
        getSpan={(p) => () => (expanded() === p.id ? 2 : 1)}
      >
        {(p) => <span>{p.id}</span>}
      </Masonry>
    </div>
  ));
  await frame();
  expanded.set("p1");
  await vi.waitUntil(() => document.querySelectorAll("[data-rv-item]")[1]!.getAnimations().length > 0, { timeout: 2000, interval: 8 });
  await vi.waitUntil(() => [...document.querySelectorAll<HTMLElement>("[data-rv-item]")].every((el) => !el.getAnimations().length), {
    timeout: 3000,
    interval: 16,
  });
});

test("reduced motion: animateLayout applies the update without animating", async () => {
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => (query.includes("reduce") ? ({ matches: true } as MediaQueryList) : real(query)));
  const justify = signal("flex-start");
  render(() => (
    <div id="row" style={{ display: "flex", width: "400px", "justify-content": justify() }}>
      <Motion.div id="box" layout style={{ width: "50px", height: "50px" }} />
    </div>
  ));
  const result = await animateLayout(byId("row"), () => justify.set("flex-end"));
  expect(left("box") - byId("row").getBoundingClientRect().left).toBe(350);
  expect(byId("box").getAnimations().length).toBe(0);
  await result.finished;
});

test("a no-move update settles at once", async () => {
  const row = document.createElement("div");
  row.innerHTML = '<div data-layout="true" style="width:50px;height:50px"></div>';
  document.body.append(row);
  const start = performance.now();
  const result = await animateLayout(row, () => {});
  await result.finished;
  expect(performance.now() - start).toBeLessThan(50);
  row.remove();
});
