// Behaviour tests (Chromium, client render) for `@rivetjs/cdk/lightbox` core. Cases ported from yet-another-react-lightbox
// (test/unit/Lightbox.spec.ts, v3.32.2, MIT, © Igor Danchenko): open prop, basic controls, index prop, navigation buttons,
// wheel navigation. Rivet: keyboard + RTL, Escape, focus trap + restore, swipe (finish / cancel / finite edge), pull to
// close, backdrop click, preload window, lifecycle callbacks, controlled index, house-motion settle.
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Lightbox, LightboxCarousel, LightboxClose, LightboxNext, LightboxPrevious, LightboxToolbar, type LightboxSlide } from "../lightbox/index.tsx";

afterEach(() => cleanup());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await sleep(16);
  }
};
const svg = (label: string, w = 400, h = 300) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#888"/><text x="10" y="40">${label}</text></svg>`)}`;
const slides: LightboxSlide[] = [1, 2, 3, 4, 5].map((i) => ({ src: svg(`image${i}`), alt: `image${i}`, width: 400, height: 300 }));

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const current = () => q<HTMLImageElement>("[data-lightbox-slide][data-current] img")?.alt;
const button = (action: string) => q<HTMLButtonElement>(`[data-action="${action}"]`)!;
const container = () => q<HTMLElement>("[data-lightbox-container]")!;
const transform = () => q<HTMLElement>("[data-lightbox-carousel]")!.style.transform;
const settled = () => until(() => transform() === "");

async function open(props: Record<string, unknown> = {}, children?: () => unknown) {
  const isOpen = signal(true);
  render(() => (
    <Lightbox isOpen={isOpen} slides={slides} {...props}>
      {children as never}
    </Lightbox>
  ));
  for (let i = 0; i < 3; i++) await flush();
  await until(() => !!q("[data-lightbox-container]"));
  return isOpen;
}

const pointer = (target: EventTarget, type: string, x: number, y: number, id = 1) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: "mouse",
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );

async function drag(dx: number, dy: number, steps = 6, delay = 16) {
  const el = q("[data-lightbox-slide][data-current]")!;
  const r = container().getBoundingClientRect();
  const x = r.left + r.width / 2,
    y = r.top + r.height / 2;
  pointer(el, "pointerdown", x, y);
  for (let i = 1; i <= steps; i++) {
    pointer(el, "pointermove", x + (dx * i) / steps, y + (dy * i) / steps);
    if (delay) await sleep(delay);
  }
  pointer(el, "pointerup", x + dx, y + dy);
  await flush();
}

describe("Lightbox (YARL Lightbox.spec)", () => {
  it("respects open prop", async () => {
    const isOpen = signal(false);
    render(() => <Lightbox isOpen={isOpen} slides={slides} />);
    await flush();
    expect(q("[data-lightbox-container]")).toBeNull();
    isOpen.set(true);
    for (let i = 0; i < 3; i++) await flush();
    expect(q("[data-lightbox-container]")).not.toBeNull();
    expect(container().getAttribute("role")).toBe("dialog");
    expect(container().getAttribute("aria-label")).toBe("Lightbox");
  });

  it("presents basic controls", async () => {
    await open();
    expect(button("close").getAttribute("aria-label")).toBe("Close");
    expect(button("prev").getAttribute("aria-label")).toBe("Previous");
    expect(button("next").getAttribute("aria-label")).toBe("Next");
    expect(q("[data-lightbox-carousel]")!.getAttribute("aria-roledescription")).toBe("carousel");
  });

  it("respects index prop", async () => {
    for (const index of [0, 2, 4]) {
      await open({ index });
      expect(current()).toBe(`image${index + 1}`);
      cleanup();
    }
  });

  it("provides navigation buttons (wraps around)", async () => {
    await open();
    button("next").click();
    await flush();
    expect(current()).toBe("image2");
    button("prev").click();
    button("prev").click();
    await flush();
    expect(current()).toBe("image5");
  });

  it("supports wheel navigation", async () => {
    await open();
    const wheel = (deltaX: number, deltaY = 0, ctrlKey = false) =>
      container().dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX, deltaY, ctrlKey }));
    // vertical / ctrl / small intents do nothing
    wheel(0, 100);
    wheel(100, 0, true);
    wheel(10);
    await flush();
    expect(current()).toBe("image1");
    // intent > 30 px starts the swipe, > 20 % of the width finishes it
    wheel(40);
    for (let i = 0; i < 20; i++) wheel(60);
    await flush();
    expect(current()).toBe("image2");
  });
});

describe("Lightbox: keyboard, focus, Escape", () => {
  it("ArrowRight / ArrowLeft navigate (throttled), RTL mirrors", async () => {
    await open({ animation: { swipe: 0 } });
    const key = (k: string) => container().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowRight");
    await flush();
    expect(current()).toBe("image2");
    key("ArrowLeft");
    await flush();
    expect(current()).toBe("image1");
    cleanup();
    document.documentElement.dir = "rtl";
    try {
      await open({ animation: { swipe: 0 } });
      key("ArrowLeft");
      await flush();
      expect(current()).toBe("image2");
    } finally {
      document.documentElement.dir = "";
    }
  });

  it("focuses the container, traps Tab and restores focus on close", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.append(trigger);
    trigger.focus();
    const isOpen = signal(false);
    render(() => <Lightbox isOpen={isOpen} slides={slides} />);
    isOpen.set(true);
    for (let i = 0; i < 3; i++) await flush();
    await until(() => document.activeElement === container());
    // everything outside is inert
    expect(trigger.closest("[inert]") !== null || trigger.inert).toBe(true);
    isOpen.set(false);
    await until(() => !q("[data-lightbox-container]"));
    await until(() => document.activeElement === trigger);
    trigger.remove();
  });

  it("Escape closes (closeOnEscape) and calls onOpenChange", async () => {
    const onOpenChange = vi.fn();
    render(() => <Lightbox defaultOpen onOpenChange={onOpenChange} slides={slides} />);
    for (let i = 0; i < 3; i++) await flush();
    await until(() => document.activeElement === container());
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await flush();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closeOnEscape: false keeps it open", async () => {
    const isOpen = await open({ controller: { closeOnEscape: false } });
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await flush();
    expect(isOpen()).toBe(true);
  });

  it("Close button closes", async () => {
    const isOpen = await open();
    button("close").click();
    await flush();
    expect(isOpen()).toBe(false);
  });
});

describe("Lightbox: swipe + pull (house motion)", () => {
  it("a long drag finishes the swipe and the track settles", async () => {
    await open();
    await drag(-300, 0);
    expect(current()).toBe("image2");
    await settled();
  });

  it("a short slow drag cancels and springs back", async () => {
    await open({ animation: { swipe: 50 } });
    await drag(-60, 0, 6, 30);
    expect(current()).toBe("image1");
    await settled();
  });

  it("a finite carousel does not swipe past its ends; Previous is disabled at the start", async () => {
    await open({ carousel: { finite: true } });
    expect(button("prev").disabled).toBe(true);
    await drag(300, 0);
    expect(current()).toBe("image1");
    await drag(-300, 0);
    expect(current()).toBe("image2");
    expect(button("prev").disabled).toBe(false);
  });

  it("disableSwipeNavigation ignores drags", async () => {
    await open({ controller: { disableSwipeNavigation: true } });
    await drag(-300, 0);
    expect(current()).toBe("image1");
  });

  it("pull down closes past 60 px (closeOnPullDown); a short pull springs back", async () => {
    const isOpen = await open({ controller: { closeOnPullDown: true } });
    await drag(0, 40);
    expect(isOpen()).toBe(true);
    await drag(0, 200);
    expect(isOpen()).toBe(false);
  });

  it("closeOnBackdropClick closes on a slide-box click, not on the image", async () => {
    const isOpen = await open({ controller: { closeOnBackdropClick: true } });
    const img = q("[data-lightbox-slide][data-current] img")!;
    pointer(img, "pointerdown", 1, 1);
    pointer(img, "pointerup", 1, 1);
    expect(isOpen()).toBe(true);
    const box = q("[data-lightbox-slide][data-current]")!;
    pointer(box, "pointerdown", 1, 1);
    pointer(box, "pointerup", 1, 1);
    await flush();
    expect(isOpen()).toBe(false);
  });
});

describe("Lightbox: carousel window + callbacks", () => {
  it("renders 2 × preload + 1 slides, offscreen slides are inert and labelled k of N", async () => {
    await open();
    const boxes = [...document.querySelectorAll("[data-lightbox-slide]")];
    expect(boxes.length).toBe(5);
    expect(boxes.filter((b) => (b as HTMLElement).inert).length).toBe(4);
    expect(q("[data-lightbox-slide][data-current]")!.getAttribute("aria-label")).toBe("1 of 5");
    cleanup();
    await open({ carousel: { preload: 1 } });
    expect(document.querySelectorAll("[data-lightbox-slide]").length).toBe(3);
    cleanup();
    await open({ carousel: { finite: true } });
    // finite at index 0: no slides before the first
    expect(document.querySelectorAll("[data-lightbox-slide]").length).toBe(3);
  });

  it("keeps slide nodes across navigation (keyed by position)", async () => {
    await open();
    const second = q("[data-lightbox-slide][data-index='1']");
    button("next").click();
    await flush();
    expect(q("[data-lightbox-slide][data-current]") === second).toBe(true);
  });

  it("onView on open + every change; onClick on the current image; onEntering / onEntered / onExiting / onExited", async () => {
    const onView = vi.fn(),
      onClick = vi.fn(),
      onEntering = vi.fn(),
      onEntered = vi.fn(),
      onExiting = vi.fn(),
      onExited = vi.fn();
    const isOpen = await open({ onView, onClick, onEntering, onEntered, onExiting, onExited });
    await until(() => onEntered.mock.calls.length === 1);
    expect(onEntering).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenLastCalledWith({ index: 0 });
    button("next").click();
    await flush();
    expect(onView).toHaveBeenLastCalledWith({ index: 1 });
    q<HTMLImageElement>("[data-lightbox-slide][data-current] img")!.click();
    expect(onClick).toHaveBeenCalledWith({ index: 1 });
    isOpen.set(false);
    await until(() => onExited.mock.calls.length === 1);
    expect(onExiting).toHaveBeenCalledTimes(1);
  });

  it("controlled index: external changes jump, navigation writes the signal", async () => {
    const index = signal(1);
    await open({ index });
    expect(current()).toBe("image2");
    button("next").click();
    await flush();
    expect(index()).toBe(2);
    index.set(4);
    for (let i = 0; i < 3; i++) await flush();
    expect(current()).toBe("image5");
  });

  it("custom parts and render function (YARL render.slide)", async () => {
    await open({}, () => (
      <>
        <LightboxCarousel>{(slide, info) => <div class="custom">{`${(slide as { alt?: string }).alt}:${info.index}`}</div>}</LightboxCarousel>
        <LightboxToolbar>
          <LightboxClose label="Dismiss" />
        </LightboxToolbar>
        <LightboxPrevious />
        <LightboxNext />
      </>
    ));
    expect(q("[data-lightbox-slide][data-current] .custom")!.textContent).toBe("image1:0");
    expect(button("close").getAttribute("aria-label")).toBe("Dismiss");
  });
});
