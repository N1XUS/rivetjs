// T12: `@rivetjs/motion/layout` on the shared FLIP core: animateLayout (Motion's vanilla signature), layoutId shared
// elements across a swap (tabs underline), layoutDriver for cdk Masonry, reduced motion.
import { afterEach, expect, test, vi } from "vitest";
import { signal, _activating } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Motion } from "@rivetjs/motion";
import { animateLayout, LayoutGroup, layoutDriver } from "@rivetjs/motion/layout";
import { Masonry } from "@rivetjs/cdk/masonry";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const byId = (id: string) => document.getElementById(id)!;
const left = (id: string) => byId(id).getBoundingClientRect().left;

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

// A resumed page's first interaction: the handler's update re-creates its region once the region's chunks loaded
// (dom-resume calls `_activating.start()`, filled by `/layout`), and the row (it read a signal) is a new element with the
// server row's id.
const pendingRecreation = () => _activating.start!();
const flexRow = () => {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;width:400px";
  const make = (justify: string) => {
    row.style.justifyContent = justify;
    const box = document.createElement("div");
    box.id = "late";
    box.setAttribute("data-layout", "true");
    box.style.cssText = "width:50px;height:50px";
    row.replaceChildren(box);
  };
  make("flex-start");
  document.body.append(row);
  return { row, make };
};

test("resumed page: an update applied after its pending re-creation still animates, re-created elements by id", async () => {
  const { row, make } = flexRow();
  let ran!: () => void;
  const result = await animateLayout(
    row,
    () => {
      ran = pendingRecreation();
      setTimeout(() => (make("flex-end"), ran()), 40);
    },
    { duration: 0.3, ease: "linear" },
  );
  await new Promise((resolve) => setTimeout(resolve, 140));
  const mid = left("late") - row.getBoundingClientRect().left;
  expect(mid).toBeGreaterThan(20);
  expect(mid).toBeLessThan(330);
  await result.finished;
  expect(left("late") - row.getBoundingClientRect().left).toBe(350);
  row.remove();
});

test("resumed page after the first re-creation: a no-move update settles at once", async () => {
  (document as { $r?: unknown }).$r = {};
  try {
    const row = document.createElement("div");
    row.innerHTML = '<div data-layout="true" style="width:50px;height:50px"></div>';
    document.body.append(row);
    const start = performance.now();
    const result = await animateLayout(row, () => {});
    await result.finished;
    expect(performance.now() - start).toBeLessThan(50);
    row.remove();
  } finally {
    delete (document as { $r?: unknown }).$r;
  }
});

test("a later animateLayout on the same root cancels an earlier one still waiting for a re-creation", async () => {
  const { row, make } = flexRow();
  const ran = pendingRecreation();
  try {
    // Nothing reached the DOM yet: the first call waits for the pending activation.
    const first = await animateLayout(row, () => {});
    let settled = false;
    void first.finished.then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    const second = await animateLayout(row, () => make("flex-end"), { duration: 0.3, ease: "linear" });
    // The first settles without playing; the second (it moved the element) plays at once.
    await first.finished;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mid = left("late") - row.getBoundingClientRect().left;
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(330);
    await second.finished;
    expect(left("late") - row.getBoundingClientRect().left).toBe(350);
  } finally {
    ran();
  }
  row.remove();
});

test("a pending unrelated activation does not delay an update that already moved elements", async () => {
  const { row, make } = flexRow();
  const ran = pendingRecreation();
  try {
    const result = await animateLayout(row, () => make("flex-end"), { duration: 0.3, ease: "linear" });
    // `make` replaced the element (as a re-creation would) and moved it: it animates at once.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mid = left("late") - row.getBoundingClientRect().left;
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(330);
    await result.finished;
  } finally {
    ran();
  }
  row.remove();
});

test("an activation that never ends caps the wait: a no-move update still settles", async () => {
  const row = document.createElement("div");
  row.innerHTML = '<div data-layout="true" style="width:50px;height:50px"></div>';
  document.body.append(row);
  const ran = pendingRecreation();
  try {
    const start = performance.now();
    const result = await animateLayout(row, () => {});
    await result.finished;
    const took = performance.now() - start;
    expect(took).toBeGreaterThan(1900);
    expect(took).toBeLessThan(2600);
  } finally {
    ran();
  }
  row.remove();
});
