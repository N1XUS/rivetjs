// `@rivetjs/cdk/flip` pure parts (motion plan T11): permission + driver contract (the DOM parts: flip.browser.test.tsx).
import { expect, test } from "vitest";
import { flipAllowed, motion1dDriver, playFlip, type FlipDriver, type FlipRun } from "../flip/index.ts";

test("flipAllowed: false for motion={false}; reduced motion off by default", () => {
  expect(flipAllowed(false)).toBe(false);
  expect(flipAllowed(undefined)).toBe(typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
});

test("motion1dDriver: a driver (play returns stop)", () => {
  expect(typeof motion1dDriver().play).toBe("function");
  expect(typeof motion1dDriver({ duration: 10, friction: 0.5 }).play).toBe("function");
});

test("playFlip: unchanged items never reach the driver; a custom driver gets the moved ones", () => {
  if (typeof document === "undefined") return;
  const container = document.body.appendChild(document.createElement("div"));
  const a = container.appendChild(document.createElement("div"));
  const b = container.appendChild(document.createElement("div"));
  const runs: FlipRun[] = [];
  const driver: FlipDriver = { play: (run) => (runs.push(run), () => {}) };
  const box = (x: number, y: number) => ({ x, y, width: 10, height: 10 });
  playFlip(container, [{ el: a, from: box(0, 0), to: box(0, 0) }], { driver });
  expect(runs).toHaveLength(0);
  playFlip(
    container,
    [
      { el: a, from: box(0, 0), to: box(20, 0) },
      { el: b, from: box(0, 0), to: box(0, 0.2) },
    ],
    { driver },
  );
  expect(runs).toHaveLength(1);
  expect(runs[0]!.items.map((i) => i.el)).toEqual([a]);
  expect(a.style.transform).toBe("translate(-20px, 0px)");
  runs[0]!.done();
  expect(a.style.transform).toBe("");
  container.remove();
});
