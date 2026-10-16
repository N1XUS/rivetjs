// `@rivetjs/cdk/flip` (motion plan T11, extracted from masonry): moved / resized elements animate from their old box,
// interruption starts from the current boxes, viewport skip, reduced motion, custom drivers, final styles.
import { afterEach, expect, test, vi } from "vitest";
import { animatingBoxes, captureBoxes, flipAllowed, playFlip, stopFlip, type Box, type FlipDriver, type FlipRun } from "../flip/index.ts";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
let container: HTMLDivElement;
const setup = () => {
  container = document.body.appendChild(document.createElement("div"));
  container.style.cssText = "position: relative; width: 300px; height: 300px";
  const make = (left: number, top: number) => {
    const el = container.appendChild(document.createElement("div"));
    el.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; width: 50px; height: 50px`;
    return el;
  };
  return [make(0, 0), make(100, 0), make(0, 100)] as const;
};
afterEach(() => {
  container?.remove();
  vi.restoreAllMocks();
});
const move = (el: HTMLElement, left: number, top: number) => {
  el.style.left = left + "px";
  el.style.top = top + "px";
};

test("captureBoxes: start-edge boxes relative to the container (LTR and RTL)", () => {
  const [a, b] = setup();
  const ltr = captureBoxes([a, b], container);
  expect(ltr.get(b)).toEqual({ x: 100, y: 0, width: 50, height: 50 });
  expect(captureBoxes([b], container, true).get(b)).toEqual({ x: 150, y: 0, width: 50, height: 50 });
  expect(ltr.get(a)!.x).toBe(0);
});

test("moved elements travel from the old box; the overrides go away when settled", async () => {
  const [a, b] = setup();
  const before = captureBoxes([a, b], container);
  move(a, 200, 200);
  const after = captureBoxes([a, b], container);
  playFlip(
    container,
    [a, b].map((el) => ({ el, from: before.get(el)!, to: after.get(el)! })),
  );
  expect(a.style.transform).toBe("translate(-200px, -200px)");
  expect(b.style.transform).toBe("");
  await frame();
  await frame();
  const mid = a.getBoundingClientRect().left - container.getBoundingClientRect().left;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(200);
  await vi.waitUntil(() => a.style.transform === "", { timeout: 3000, interval: 16 });
  expect(a.getBoundingClientRect().left - container.getBoundingClientRect().left).toBe(200);
});

test("resized elements animate their size; stop commits the final boxes", () => {
  const [a] = setup();
  const from: Box = { x: 0, y: 0, width: 50, height: 50 };
  a.style.width = "150px";
  const stop = playFlip(container, [{ el: a, from, to: { ...from, width: 150 } }]);
  expect(a.style.width).toBe("50px");
  stop();
  expect(a.style.width).toBe("150px");
  expect(a.style.transform).toBe("");
});

test("interruption: animatingBoxes gives the visual boxes; a new playFlip stops the running one", async () => {
  const [a] = setup();
  const before = captureBoxes([a], container);
  move(a, 200, 0);
  playFlip(container, [{ el: a, from: before.get(a)!, to: captureBoxes([a], container).get(a)! }]);
  await frame();
  await frame();
  const visual = animatingBoxes(container).get(a)!;
  expect(visual.x).toBeGreaterThan(0);
  expect(visual.x).toBeLessThan(200);
  move(a, 0, 0);
  // The new box from the layout (a read now would include the running offset).
  playFlip(container, [{ el: a, from: visual, to: { x: 0, y: 0, width: 50, height: 50 } }]);
  expect(parseFloat(a.style.transform.slice(10))).toBeCloseTo(visual.x, 2);
  stopFlip(container);
  expect(animatingBoxes(container).size).toBe(0);
});

test("viewport: elements outside the band before and after jump", () => {
  const [a, b] = setup();
  const runs: FlipRun[] = [];
  const driver: FlipDriver = { play: (run) => (runs.push(run), () => {}) };
  playFlip(
    container,
    [
      { el: a, from: { x: 0, y: 1000, width: 50, height: 50 }, to: { x: 50, y: 1100, width: 50, height: 50 } },
      { el: b, from: { x: 0, y: 0, width: 50, height: 50 }, to: { x: 50, y: 0, width: 50, height: 50 } },
    ],
    { viewport: [0, 500], driver },
  );
  expect(runs[0]!.items.map((i) => i.el)).toEqual([b]);
  expect(a.style.transform).toBe("");
});

test("custom driver: receives every moved item, drives render(t), done commits final styles", () => {
  const [a, b, c] = setup();
  const runs: FlipRun[] = [];
  const stopped: number[] = [];
  const driver: FlipDriver = { play: (run) => (runs.push(run), () => stopped.push(1)) };
  const box = (x: number) => ({ x, y: 0, width: 50, height: 50 });
  playFlip(
    container,
    [
      { el: a, from: box(0), to: box(100) },
      { el: b, from: box(100), to: box(0), final: () => ({ transform: "translateX(1px)" }) },
      { el: c, from: box(0), to: box(0) },
    ],
    { driver, rtl: true },
  );
  expect(runs[0]!.items.map((i) => i.el)).toEqual([a, b]);
  runs[0]!.render(0.5);
  // RTL: start-edge x grows to the left.
  expect(a.style.transform).toBe("translate(50px, 0px)");
  runs[0]!.done();
  expect(b.style.transform).toBe("translateX(1px)");
  expect(a.style.transform).toBe("");
  expect(stopped).toHaveLength(1);
});

test("reduced motion / motion={false}: flipAllowed is false", () => {
  expect(flipAllowed(false)).toBe(false);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("reduce") }) as MediaQueryList);
  expect(flipAllowed(true)).toBe(false);
  expect(flipAllowed(undefined)).toBe(false);
});
