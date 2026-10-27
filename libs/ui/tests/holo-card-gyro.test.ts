// Rivet-authored sensor math and lifecycle tests; no hardware or browser permission is needed.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { installDom } from "./install-dom.ts";
import { holoOrientationPoint, trackHoloOrientation } from "../src/components/holo-card/holo-card-gyro.ts";

const win = installDom();
let intersect: IntersectionObserverCallback;
let motion: MediaQueryList;
let frames: Map<number, FrameRequestCallback>;
let serial = 0;
let cleanups: (() => void)[];

beforeEach(() => {
  vi.useFakeTimers();
  cleanups = [];
  frames = new Map();
  motion = Object.assign(new win.EventTarget(), { matches: false }) as unknown as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockReturnValue(motion);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++serial, cb);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const reading = (beta: number | null, gamma: number | null) => {
  const event = new win.Event("deviceorientation");
  Object.assign(event, { beta, gamma });
  window.dispatchEvent(event as unknown as Event);
};
const visibility = (element: HTMLElement, visible: boolean) =>
  intersect([{ target: element, isIntersecting: visible } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
const flush = () => {
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach((cb) => cb(0));
};
function card() {
  const element = document.createElement("div");
  const write = vi.fn();
  const controller = trackHoloOrientation(element, write, () => true);
  cleanups.push(controller.dispose);
  return { element, write, ...controller };
}

test("baseline, 25 degree limits and screen rotations", () => {
  const base = { beta: 40, gamma: 10 };
  expect(holoOrientationPoint(base, base, 0)).toEqual([50, 50]);
  expect(holoOrientationPoint({ beta: 65, gamma: -15 }, base, 0)).toEqual([0, 100]);
  expect(holoOrientationPoint({ beta: 100, gamma: 90 }, base, 0)).toEqual([100, 100]);
  for (const [angle, point] of [
    [0, [70, 90]],
    [90, [90, 30]],
    [-90, [10, 70]],
    [270, [10, 70]],
    [180, [30, 10]],
  ] as const) {
    expect(holoOrientationPoint({ beta: 60, gamma: 20 }, base, angle)).toEqual(point);
  }
  expect(holoOrientationPoint({ beta: -179, gamma: 0 }, { beta: 179, gamma: 0 }, 0)).toEqual([50, 54]);
});

test("three cards share one listener; viewport, visibility and disposal detach it", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const all = [card(), card(), card()];
  const count = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === "deviceorientation").length;
  expect(count(add)).toBe(0);
  all.forEach((item) => visibility(item.element, true));
  expect(count(add)).toBe(1);
  reading(40, 10);
  flush();
  all.forEach((item) => expect(item.write).toHaveBeenLastCalledWith(item.element, 50, 50, 1));
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  document.dispatchEvent(new win.Event("visibilitychange") as unknown as Event);
  expect(count(remove as typeof add)).toBe(1);
  expect(frames.size).toBe(0);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.dispatchEvent(new win.Event("visibilitychange") as unknown as Event);
  expect(count(add)).toBe(2);
  all.forEach((item) => visibility(item.element, false));
  expect(count(remove as typeof add)).toBe(2);
  all.forEach((item) => visibility(item.element, true));
  all.forEach((item) => item.dispose());
  expect(count(remove as typeof add)).toBe(3);
});

test("null sensor data times out silently after one second and does not retry", () => {
  const item = card();
  visibility(item.element, true);
  reading(null, 10);
  reading(20, null);
  reading(NaN, 0);
  vi.advanceTimersByTime(1000);
  reading(40, 10);
  flush();
  expect(item.active()).toBe(false);
  expect(item.write).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

test("sensor writes coalesce, smooth and stop once unchanged; leave and return recalibrates", () => {
  const item = card();
  visibility(item.element, true);
  reading(40, 10);
  flush();
  reading(40, 35);
  reading(40, 35);
  expect(frames.size).toBe(1);
  flush();
  expect(item.write).toHaveBeenLastCalledWith(item.element, 60, 50, 1);
  for (let i = 0; i < 40; i++) flush();
  expect(item.write).toHaveBeenLastCalledWith(item.element, 100, 50, 1);
  const count = item.write.mock.calls.length;
  reading(40, 35);
  flush();
  expect(item.write).toHaveBeenCalledTimes(count);
  visibility(item.element, false);
  expect(item.write).toHaveBeenLastCalledWith(item.element, 50, 50, 0);
  visibility(item.element, true);
  reading(70, -20);
  flush();
  expect(item.write).toHaveBeenLastCalledWith(item.element, 50, 50, 1);
});

test("reduced motion pauses sensor work and returns the card to flat and unlit", () => {
  const item = card();
  Object.defineProperty(motion, "matches", { configurable: true, value: true });
  visibility(item.element, true);
  reading(40, 10);
  expect(item.active()).toBe(false);
  expect(frames.size).toBe(0);
  Object.defineProperty(motion, "matches", { configurable: true, value: false });
  motion.dispatchEvent(new win.Event("change") as unknown as Event);
  reading(40, 10);
  flush();
  Object.defineProperty(motion, "matches", { configurable: true, value: true });
  motion.dispatchEvent(new win.Event("change") as unknown as Event);
  expect(item.active()).toBe(false);
  expect(item.write).toHaveBeenLastCalledWith(item.element, 50, 50, 0);
});

for (const outcome of ["granted", "denied", "throw", "reject", "unsupported"]) {
  test(`permission: ${outcome}, synchronous request and once per page`, async () => {
    // A distinct module instance stands for a fresh page; native Node imports preserve URL query identities.
    const url = new URL(`../src/components/holo-card/holo-card-input.ts?${outcome}`, import.meta.url);
    const { requestHoloOrientation } = await import(url.href);
    const request = vi.fn(() => {
      if (outcome === "throw") throw new Error("blocked");
      return outcome === "reject" ? Promise.reject(new Error("blocked")) : Promise.resolve(outcome);
    });
    Object.defineProperty(window, "DeviceOrientationEvent", {
      configurable: true,
      value: outcome === "unsupported" ? undefined : { requestPermission: request },
    });
    const result = requestHoloOrientation();
    expect(request).toHaveBeenCalledTimes(outcome === "unsupported" ? 0 : 1);
    expect(requestHoloOrientation()).toBe(result);
    expect(await result).toBe(outcome === "granted" || outcome === "unsupported");
  });
}
