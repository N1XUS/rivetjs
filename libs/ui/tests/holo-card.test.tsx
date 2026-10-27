// DOM-target: touch input laziness, the existing pointer writer, owner cleanup and static/reduced-motion guards.
import { expect, test, vi } from "vitest";
import { registerHooks } from "node:module";
import { installDom } from "./install-dom.ts";

const win = installDom();
const { render } = await import("@rivetjs/runtime/testing");
const { HoloCard } = await import("../src/components/holo-card/index.ts");
const drain = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
function pointer(element: Element, type: string, pointerType: string) {
  const event = new win.Event(type, { bubbles: true });
  Object.assign(event, { pointerType, clientX: 80, clientY: 20 });
  element.dispatchEvent(event as unknown as Event);
}

test("hover never imports the tracker; touch requests synchronously, uses the shared writer and cleans up on unmount", async () => {
  let imports = 0;
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.endsWith("/holo-card-gyro.ts")) imports++;
      return next(specifier, context);
    },
  });
  let reduced = false;
  const media = Object.assign(new win.EventTarget(), { matches: false }) as unknown as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => Object.assign(media, { matches: query.includes("reduced") && reduced }));
  const request = vi.fn(() => Promise.resolve("granted"));
  Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: { requestPermission: request } });
  let intersect: IntersectionObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  const r = render(() => (
    <>
      <HoloCard id="live" />
      <HoloCard id="static" isInteractive={false} />
      <HoloCard id="disabled" isDisabled />
    </>
  ));
  try {
    const live = r.container.querySelector<HTMLElement>("#live")!;
    live.getBoundingClientRect = () => ({ width: 100, height: 100, left: 0, top: 0 }) as DOMRect;
    pointer(live, "pointermove", "mouse");
    expect(live.style.getPropertyValue("--holo-card-pointer-x")).toBe("80");
    pointer(live, "pointerup", "mouse");
    pointer(r.container.querySelector("#static")!, "pointerup", "touch");
    pointer(r.container.querySelector("#disabled")!, "pointerup", "touch");
    reduced = true;
    pointer(live, "pointerup", "touch");
    await drain();
    expect(request).not.toHaveBeenCalled();
    expect(imports).toBe(0);
    reduced = false;
    pointer(live, "pointerup", "touch");
    expect(request).toHaveBeenCalledTimes(1);
    await drain();
    expect(imports).toBe(1);
    intersect!([{ target: live, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    const event = new win.Event("deviceorientation");
    Object.assign(event, { beta: 45, gamma: 10 });
    window.dispatchEvent(event as unknown as Event);
    frames.shift()!(0);
    expect(live.style.getPropertyValue("--holo-card-pointer-x")).toBe("50");
    expect(live.style.getPropertyValue("--holo-card-background-x")).toBe("50");
    expect(live.style.getPropertyValue("--holo-card-background-y")).toBe("50");
    expect(live.style.getPropertyValue("--holo-card-opacity")).toBe("1");
    pointer(live, "pointerleave", "touch");
    expect(live.style.getPropertyValue("--holo-card-opacity")).toBe("1");
    r.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    r.unmount();
    hook.deregister();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

test("disposing while permission is pending cannot attach sensor tracking", async () => {
  // The page permission is already granted in the preceding test; the import continuation still must check disposal.
  const r = render(() => <HoloCard />);
  const el = r.container.querySelector("div")!;
  const add = vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  pointer(el, "pointerup", "pen");
  r.unmount();
  await drain();
  expect(add.mock.calls.filter(([type]) => type === "deviceorientation")).toHaveLength(0);
  vi.restoreAllMocks();
});
