import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland, _drive } from "@rivetjs/bridge/client";
import { trigger } from "../../bridge/triggers.ts";
import { adapter } from "../client.ts";
import { Counter } from "./fixtures/components.solid.tsx";
import snapshot from "./fixtures/ssr.ts";

const disposers: (() => void)[] = [];
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean) => {
  const end = performance.now() + 3000;
  while (!check()) {
    if (performance.now() > end) throw Error("timed out");
    await tick();
  }
};
beforeEach(() => {
  (globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function start(on?: string, extra: Record<string, unknown> = {}) {
  document.body.innerHTML = `<rivet-island data-ri="i0" style="display:contents">${on === "only" ? "" : snapshot.i0}</rivet-island>`;
  const root = document.querySelector("rivet-island")!;
  const count = signal(1);
  let calls = 0;
  const load = async () => {
    calls++;
    return { default: Counter, adapter: adapter as never };
  };
  createRoot((dispose) => {
    disposers.push(dispose);
    const props = {
      get count() {
        return count();
      },
      label: "first",
    };
    const options = { id: "i0", ...(on ? { on: on as never } : {}), ...extra };
    if (on === undefined || on === "intent") hydrateIsland(load, root, props, options);
    else _drive(load, root, props, options, "mount", {}, () => root.replaceChildren(), trigger);
  });
  return { root, count, calls: () => calls };
}

test("load and only activate immediately; only mounts an initially empty island", async () => {
  for (const policy of ["load", "only"]) {
    const view = start(policy);
    await until(() => view.calls() === 1);
    await until(() => !!view.root.querySelector("button"));
    (view.root.querySelector("button") as HTMLButtonElement).click();
    expect(view.root.querySelector("button")!.textContent).toBe("1");
    disposers.splice(0).forEach((dispose) => dispose());
  }
});

test("static stays asleep until a live prop changes, then hydrates once with the latest snapshot", async () => {
  const view = start();
  await tick();
  expect(view.calls()).toBe(0);
  view.count.set(4);
  await until(() => view.calls() === 1);
  view.count.set(9);
  await until(() => view.root.querySelector(".count")?.textContent === "9");
  expect(view.calls()).toBe(1);
});

test("idle loads only when the browser's idle callback fires", async () => {
  let idle: IdleRequestCallback | undefined;
  vi.stubGlobal("requestIdleCallback", (fn: IdleRequestCallback) => {
    idle = fn;
    return 1;
  });
  vi.stubGlobal("cancelIdleCallback", () => {});
  try {
    const view = start("idle");
    await tick();
    expect(view.calls()).toBe(0);
    idle!({ didTimeout: false, timeRemaining: () => 20 });
    await until(() => view.calls() === 1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("interaction waits for pointerdown, then loads one interactive Solid island", async () => {
  const view = start("interaction");
  await tick();
  expect(view.calls()).toBe(0);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await until(() => view.calls() === 1);
  await tick();
  (view.root.querySelector("button") as HTMLButtonElement).click();
  expect(view.root.querySelector("button")?.textContent).toBe("1");
});

test("intent replays the first cold click once through the real bridge driver", async () => {
  const view = start("intent");
  await tick();
  expect(view.calls()).toBe(0);
  const button = view.root.querySelector("button") as HTMLButtonElement;
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  button.click();
  await until(() => view.root.querySelector("button")?.textContent === "1");
  expect(view.calls()).toBe(1);
});

test("visible waits for the observer, and disposal cancels a waiting island", async () => {
  let notify: IntersectionObserverCallback | undefined;
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  try {
    const view = start("visible");
    await tick();
    expect(view.calls()).toBe(0);
    notify!([{ isIntersecting: true, target: view.root } as IntersectionObserverEntry], {} as IntersectionObserver);
    await until(() => view.calls() === 1);
    disposers.splice(0).forEach((dispose) => dispose());
    const waiting = start("visible");
    disposers.splice(0).forEach((dispose) => dispose());
    notify!([{ isIntersecting: true, target: waiting.root } as IntersectionObserverEntry], {} as IntersectionObserver);
    await tick();
    expect(waiting.calls()).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("media waits for its matching change", async () => {
  let changed: ((event: MediaQueryListEvent) => void) | undefined;
  const query = { matches: false, addEventListener: (_: string, fn: typeof changed) => (changed = fn), removeEventListener() {} };
  vi.stubGlobal("matchMedia", () => query);
  try {
    const view = start("media:(min-width: 1px)");
    await tick();
    expect(view.calls()).toBe(0);
    query.matches = true;
    changed!({ matches: true } as MediaQueryListEvent);
    await until(() => view.calls() === 1);
  } finally {
    vi.unstubAllGlobals();
  }
});
