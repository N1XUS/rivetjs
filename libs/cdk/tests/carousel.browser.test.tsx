// Rivet tests (no upstream component suite: embla's engine suite is ported in `carousel-*.test.ts`) for the Carousel
// parts on the embla engine, client-rendered in Chromium (real layout): W3C APG roles / labels, previous / next,
// drag (snap, dragFree), loop, RTL, vertical, keyboard, tabbed picker, autoplay (fake timers), rotation control.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { screen } from "@testing-library/dom";
import {
  Carousel,
  CarouselContainer,
  CarouselDots,
  CarouselNext,
  CarouselPrevious,
  CarouselRotationControl,
  CarouselSlide,
  CarouselViewport,
  type CarouselProps,
} from "../carousel/index.tsx";
import type { EmblaCarouselType } from "../carousel/engine/index.ts";

const WIDTH = 300;

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = `
    .rv-CarouselViewport { width: ${WIDTH}px; }
    [data-orientation="vertical"] .rv-CarouselViewport { height: 200px; }
    [data-orientation="vertical"] .rv-CarouselContainer { height: 200px; }
    .rv-CarouselSlide { height: 100px; box-sizing: border-box; }
  `;
  document.head.append(style);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    let left = n;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
const until = async (check: () => boolean, timeout = 3000) => {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error("timed out");
    await frames(1);
  }
};
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function renderCarousel(props: Partial<CarouselProps> = {}, count = 5, extra?: () => unknown) {
  let api: EmblaCarouselType | undefined;
  const selected: number[] = [];
  render((() => (
    <Carousel aria-label="Featured" {...props} onApi={(a) => (api = a)} onSelect={(i) => selected.push(i)}>
      <CarouselViewport>
        <CarouselContainer>
          {Array.from({ length: count }, (_, i) => (
            <CarouselSlide>
              <span>Slide content {i + 1}</span>
            </CarouselSlide>
          ))}
        </CarouselContainer>
      </CarouselViewport>
      <CarouselPrevious />
      <CarouselNext />
      {extra?.() as never}
    </Carousel>
  )) as never);
  const root = screen.getByRole("region", { name: "Featured" });
  const viewport = root.querySelector(".rv-CarouselViewport") as HTMLElement;
  const container = root.querySelector(".rv-CarouselContainer") as HTMLElement;
  return { root, viewport, container, api: () => api!, selected };
}

const translateX = (el: HTMLElement) => new DOMMatrix(getComputedStyle(el).transform).m41;
const translateY = (el: HTMLElement) => new DOMMatrix(getComputedStyle(el).transform).m42;

async function drag(target: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, steps = 6, stepMs = 16) {
  const init = (x: number, y: number, buttons: number): MouseEventInit => ({ clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons });
  target.dispatchEvent(new PointerEvent("pointerdown", { ...init(from.x, from.y, 1), pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousedown", init(from.x, from.y, 1)));
  for (let i = 1; i <= steps; i++) {
    await delay(stepMs);
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    document.dispatchEvent(new MouseEvent("mousemove", init(x, y, 1)));
  }
  document.dispatchEvent(new MouseEvent("mouseup", init(to.x, to.y, 0)));
}

describe("Carousel", () => {
  it("renders the W3C APG carousel structure", async () => {
    const { root, viewport } = renderCarousel();
    expect(root).toHaveAttribute("aria-roledescription", "carousel");
    expect(root).toHaveClass("rv-Carousel");
    expect(root).toHaveAttribute("data-orientation", "horizontal");
    const slides = screen.getAllByRole("group");
    expect(slides).toHaveLength(5);
    expect(slides[0]).toHaveAttribute("aria-roledescription", "slide");
    expect(viewport.style.overflow).toBe("hidden");
    expect(viewport.style.touchAction).toBe("pan-y pinch-zoom");
    await until(() => root.dataset.ready === "true");
    expect(slides[0]).toHaveAttribute("aria-label", "1 of 5");
    expect(slides[4]).toHaveAttribute("aria-label", "5 of 5");
    expect(slides[0]).toHaveAttribute("data-snapped", "true");
    expect(slides[1]).not.toHaveAttribute("data-snapped");
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next slide" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next slide" })).toHaveAttribute("aria-controls", viewport.id);
  });

  it("previous / next scroll by one snap with embla's motion and settle on the snap", async () => {
    const { root, container, api, selected } = renderCarousel({ align: "start" });
    await until(() => root.dataset.ready === "true");
    screen.getByRole("button", { name: "Next slide" }).click();
    expect(api().selectedScrollSnap()).toBe(1);
    expect(selected).toEqual([1]);
    // Mid-animation: between the snaps (ScrollBody integration, not a CSS transition).
    await frames(2);
    const mid = translateX(container);
    expect(mid).toBeLessThan(0);
    expect(mid).toBeGreaterThan(-WIDTH);
    await until(() => Math.abs(translateX(container) + WIDTH) < 0.5);
    expect(screen.getByRole("button", { name: "Previous slide" })).not.toBeDisabled();
    screen.getByRole("button", { name: "Previous slide" }).click();
    await until(() => Math.abs(translateX(container)) < 0.5);
    expect(screen.getAllByRole("group")[0]).toHaveAttribute("data-snapped", "true");
  });

  it("startIndex: CSS translate before the engine, cleared before embla measures, then embla's transform", async () => {
    // Static children: the snap count is only known up front with `slideCount` (else the engine places it).
    const { root, container, api } = renderCarousel({ startIndex: 2, align: "start", slideCount: 5 });
    expect(container.style.translate).toContain("var(--rv-carousel-slide-size, 100%)");
    await until(() => root.dataset.ready === "true");
    expect(container.style.translate).toBe("");
    expect(api().selectedScrollSnap()).toBe(2);
    expect(api().internalEngine().scrollSnaps.slice(0, 3).map(Math.round)).toEqual([0, -WIDTH, -2 * WIDTH]); // measured without the translate
    expect(translateX(container)).toBeCloseTo(-2 * WIDTH, 0);
    expect(screen.getAllByRole("group")[2]).toHaveAttribute("data-snapped", "true");
  });

  it("drag snaps to the next slide", async () => {
    const { root, viewport, container, api } = renderCarousel({ align: "start" });
    await until(() => root.dataset.ready === "true");
    const box = viewport.getBoundingClientRect();
    await drag(viewport, { x: box.left + 250, y: box.top + 50 }, { x: box.left + 100, y: box.top + 50 });
    expect(api().selectedScrollSnap()).toBe(1);
    await until(() => Math.abs(translateX(container) + WIDTH) < 0.5);
    expect(root).not.toHaveAttribute("data-dragging");
  });

  it("data-dragging while the pointer is down", async () => {
    const { root, viewport } = renderCarousel();
    await until(() => root.dataset.ready === "true");
    const box = viewport.getBoundingClientRect();
    viewport.dispatchEvent(new MouseEvent("mousedown", { clientX: box.left + 100, clientY: box.top + 10, bubbles: true, button: 0, buttons: 1 }));
    expect(root).toHaveAttribute("data-dragging", "true");
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: box.left + 100, clientY: box.top + 10, bubbles: true }));
    expect(root).not.toHaveAttribute("data-dragging");
  });

  it("dragFree keeps the momentum position (no snap)", async () => {
    const { root, viewport, container } = renderCarousel({ align: "start", dragFree: true, containScroll: false }, 8);
    await until(() => root.dataset.ready === "true");
    const box = viewport.getBoundingClientRect();
    await drag(viewport, { x: box.left + 280, y: box.top + 50 }, { x: box.left + 150, y: box.top + 50 }, 4, 30);
    await until(() => root.dataset.ready === "true" && api0(container) !== 0);
    await delay(1200);
    const x = translateX(container);
    expect(x).toBeLessThan(0);
    expect(Math.abs(x % WIDTH)).toBeGreaterThan(1);
  });

  it("loop: previous from the first slide selects the last, slides are repositioned", async () => {
    const { root, api } = renderCarousel({ loop: true, align: "start" });
    await until(() => root.dataset.ready === "true");
    expect(screen.getByRole("button", { name: "Previous slide" })).not.toBeDisabled();
    screen.getByRole("button", { name: "Previous slide" }).click();
    expect(api().selectedScrollSnap()).toBe(4);
    expect(root).toHaveAttribute("data-loop", "true");
    // embla SlideLooper: slides past the edge are translated by the content size while looping.
    await until(() => screen.getAllByRole("group").some((slide) => slide.style.transform !== "" && slide.style.transform !== "none"));
  });

  it("RTL translates in the positive direction", async () => {
    const { root, container } = renderCarousel({ direction: "rtl", align: "start", dir: "rtl" } as never);
    await until(() => root.dataset.ready === "true");
    screen.getByRole("button", { name: "Next slide" }).click();
    await until(() => Math.abs(translateX(container) - WIDTH) < 0.5);
  });

  it("vertical axis translates on y and uses up / down keys", async () => {
    const { root, viewport, container, api } = renderCarousel({ axis: "y", align: "start" });
    await until(() => root.dataset.ready === "true");
    expect(root).toHaveAttribute("data-orientation", "vertical");
    expect(container.style.flexDirection).toBe("column");
    expect(viewport.style.touchAction).toBe("pan-x pinch-zoom");
    const next = screen.getByRole("button", { name: "Next slide" });
    next.focus();
    next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(api().selectedScrollSnap()).toBe(1);
    const size = screen.getAllByRole("group")[0].getBoundingClientRect().height;
    await until(() => Math.abs(translateY(container) + size) < 0.5);
  });

  it("arrow keys on the focused carousel scroll (APG)", async () => {
    const { root, api } = renderCarousel({ align: "start" });
    await until(() => root.dataset.ready === "true");
    const next = screen.getByRole("button", { name: "Next slide" });
    next.focus();
    next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(api().selectedScrollSnap()).toBe(1);
    next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    expect(api().selectedScrollSnap()).toBe(0);
  });

  it("tabbed carousel: dots are an APG tab list controlling tab panels", async () => {
    const { root, api } = renderCarousel({ tabs: true, align: "start" }, 3, () => <CarouselDots />);
    await until(() => root.dataset.ready === "true");
    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-label", "Choose slide to display");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    const panels = screen.getAllByRole("tabpanel");
    expect(panels[1]).toHaveAttribute("aria-labelledby", tabs[1].id);
    expect(tabs[1]).toHaveAttribute("aria-controls", panels[1].id);
    tabs[2].click();
    expect(api().selectedScrollSnap()).toBe(2);
    await until(() => tabs[2].getAttribute("aria-selected") === "true");
    tabs[2].focus();
    tabs[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    expect(api().selectedScrollSnap()).toBe(1);
    expect(document.activeElement).toBe(tabs[1]);
    tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    expect(api().selectedScrollSnap()).toBe(0);
  });

  it("slidesToScroll groups slides per snap", async () => {
    const { root, api } = renderCarousel({ slidesToScroll: 2, align: "start", style: { "--rv-carousel-slide-size": "50%" } as never }, 6, () => (
      <CarouselDots />
    ));
    await until(() => root.dataset.ready === "true");
    expect(api().scrollSnapList()).toHaveLength(3);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    const slides = screen.getAllByRole("group");
    expect(slides[0]).toHaveAttribute("data-snapped", "true");
    expect(slides[1]).toHaveAttribute("data-snapped", "true");
    expect(slides[2]).not.toHaveAttribute("data-snapped");
  });

  it("CarouselContainer items: count known before layout", async () => {
    const items = signal(["a", "b", "c"]);
    render((() => (
      <Carousel aria-label="Items">
        <CarouselViewport>
          <CarouselContainer items={items}>{(item: string) => <CarouselSlide>{item}</CarouselSlide>}</CarouselContainer>
        </CarouselViewport>
      </Carousel>
    )) as never);
    const slides = screen.getAllByRole("group");
    expect(slides).toHaveLength(3);
    expect(slides[2]).toHaveAttribute("aria-label", "3 of 3");
    const root = screen.getByRole("region", { name: "Items" });
    await until(() => root.dataset.ready === "true");
    items.set(["a", "b", "c", "d"]);
    await until(() => screen.getAllByRole("group")[3]?.getAttribute("aria-label") === "4 of 4");
  });

  it("autoplay advances on its delay (fake timers), pauses on hover, rotation control stops / starts", async () => {
    const { root, api } = renderCarousel({ autoplay: { delay: 1000 }, align: "start" }, 3, () => <CarouselRotationControl />);
    await until(() => root.dataset.ready === "true" && !!(api().plugins() as Record<string, unknown>).autoplay);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const autoplay = (api().plugins() as unknown as { autoplay: { reset: () => void; isPlaying: () => boolean } }).autoplay;
    autoplay.reset(); // timer under the fake clock
    expect(root).toHaveAttribute("data-playing", "true");
    const control = screen.getByRole("button", { name: "Stop automatic slide show" });
    vi.advanceTimersByTime(1000);
    expect(api().selectedScrollSnap()).toBe(1);
    // Hover pauses (embla stopOnMouseEnter), leaving resumes.
    root.dispatchEvent(new MouseEvent("mouseenter"));
    expect(root).not.toHaveAttribute("data-playing");
    vi.advanceTimersByTime(3000);
    expect(api().selectedScrollSnap()).toBe(1);
    root.dispatchEvent(new MouseEvent("mouseleave"));
    expect(root).toHaveAttribute("data-playing", "true");
    vi.advanceTimersByTime(1000);
    expect(api().selectedScrollSnap()).toBe(2);
    // Rotation control: explicit stop survives a hover cycle.
    control.click();
    expect(control).toHaveAccessibleName("Start automatic slide show");
    root.dispatchEvent(new MouseEvent("mouseenter"));
    root.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(5000);
    expect(api().selectedScrollSnap()).toBe(2);
    expect(root).not.toHaveAttribute("data-playing");
    control.click();
    expect(control).toHaveAccessibleName("Stop automatic slide show");
    expect(root).toHaveAttribute("data-playing", "true");
    // APG: the slides container is not live while rotating.
    expect(root.querySelector(".rv-CarouselContainer")).toHaveAttribute("aria-live", "off");
  });

  it("keyboard focus in the carousel stops rotation (APG)", async () => {
    const { root, api } = renderCarousel({ autoplay: { delay: 1000 } }, 3, () => <CarouselRotationControl />);
    await until(() => root.dataset.ready === "true" && !!(api().plugins() as Record<string, unknown>).autoplay);
    expect(root).toHaveAttribute("data-playing", "true");
    const next = screen.getByRole("button", { name: "Next slide" });
    // Keyboard modality (focus-visible): Tab into the carousel.
    document.body.focus();
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.tab();
    while (!root.contains(document.activeElement)) await user.tab();
    expect(root).not.toHaveAttribute("data-playing");
    expect(screen.getByRole("button", { name: "Start automatic slide show" })).toBeInTheDocument();
    void next;
  });

  it("active: false starts an inactive engine without errors (embla leaves plugins() undefined); rotation control is safe", async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener("error", onError);
    try {
      const { root, api } = renderCarousel({ active: false, autoplay: true }, 3, () => <CarouselRotationControl />);
      await until(() => root.dataset.ready === "true");
      expect(api().plugins()).toBeUndefined();
      expect(root).not.toHaveAttribute("data-playing");
      screen.getByRole("button", { name: "Stop automatic slide show" }).click();
      screen.getByRole("button", { name: "Start automatic slide show" }).click();
      await delay(50);
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener("error", onError);
    }
  });

  it("prefers-reduced-motion: reduce — autoplay, buttons, dots and the drag release land at once (live on media change)", async () => {
    let reduce = true;
    const real = window.matchMedia;
    window.matchMedia = ((query: string) =>
      query.includes("prefers-reduced-motion")
        ? ({ ...real.call(window, query), matches: reduce, media: query } as MediaQueryList)
        : real.call(window, query)) as typeof window.matchMedia;
    try {
      const { root, viewport, container, api } = renderCarousel({ align: "start", tabs: true, autoplay: { delay: 300 } }, 5, () => (
        <>
          <CarouselDots />
          <CarouselRotationControl />
        </>
      ));
      await until(() => root.dataset.ready === "true" && !!(api().plugins() as Record<string, unknown>).autoplay);
      const at = (snap: number) => Math.abs(translateX(container) + snap * WIDTH) < 0.5;
      // Autoplay advance: lands at once.
      await until(() => api().selectedScrollSnap() === 1, 2000);
      await frames(2);
      expect(at(1)).toBe(true);
      screen.getByRole("button", { name: "Stop automatic slide show" }).click();
      screen.getByRole("button", { name: "Previous slide" }).click();
      await frames(2);
      expect(at(0)).toBe(true);
      // Next: no in-between frame — on the target by the second frame (embla's own motion takes ~20 frames).
      screen.getByRole("button", { name: "Next slide" }).click();
      await frames(2);
      expect(at(1)).toBe(true);
      // Dot.
      screen.getAllByRole("tab")[3]!.click();
      await frames(2);
      expect(at(3)).toBe(true);
      // Drag: the track follows the pointer while down, the release settles at once.
      const box = viewport.getBoundingClientRect();
      await drag(viewport, { x: box.left + 100, y: box.top + 50 }, { x: box.left + 250, y: box.top + 50 });
      expect(api().selectedScrollSnap()).toBe(2);
      await frames(2);
      expect(at(2)).toBe(true);
      // Media change: the next move animates again (mid-way after two frames).
      reduce = false;
      screen.getByRole("button", { name: "Previous slide" }).click();
      await frames(2);
      expect(translateX(container)).toBeLessThan(-WIDTH - 1);
      expect(translateX(container)).toBeGreaterThan(-2 * WIDTH);
      await until(() => at(1));
    } finally {
      window.matchMedia = real;
    }
  });
});

function api0(container: HTMLElement): number {
  return translateX(container);
}
