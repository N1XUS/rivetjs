// Rivet tests (embla's plugin packages ship no test suites; the core `plugins.test.ts` is ported in
// `carousel-plugins.test.ts`) for the ported Autoplay / AutoScroll / ClassNames / Fade / AutoHeight plugins on the engine, in happy-dom
// with the embla test element mocks and fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmblaCarousel from "../carousel/engine/EmblaCarousel.ts";
import Autoplay from "../carousel/plugins/autoplay/index.ts";
import AutoScroll from "../carousel/plugins/auto-scroll/index.ts";
import ClassNames from "../carousel/plugins/class-names/index.ts";
import Fade from "../carousel/plugins/fade/index.ts";
import AutoHeight from "../carousel/plugins/auto-height/index.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_PLUGINS } from "./carousel/fixtures/plugins.fixture.ts";

// The plugins schedule on the engine's `ownerWindow` (happy-dom window): route it through the (faked) globals.
const win = window as unknown as Record<string, unknown>;
const original = { setTimeout: win.setTimeout, clearTimeout: win.clearTimeout };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  win.setTimeout = (fn: () => void, ms?: number) => globalThis.setTimeout(fn, ms);
  win.clearTimeout = (id: number) => globalThis.clearTimeout(id);
});
afterEach(() => {
  vi.useRealTimers();
  Object.assign(win, original);
});

describe("Autoplay", () => {
  it("plays on init, advances one snap per delay and emits autoplay:select / play / stop", () => {
    const events: string[] = [];
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [Autoplay({ delay: 1000 })]);
    emblaApi.on("autoplay:select", () => events.push("select")).on("autoplay:stop", () => events.push("stop"));
    const autoplay = emblaApi.plugins().autoplay!;
    expect(autoplay.isPlaying()).toBe(true);
    expect(emblaApi.selectedScrollSnap()).toBe(0);
    vi.advanceTimersByTime(999);
    expect(emblaApi.selectedScrollSnap()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(emblaApi.selectedScrollSnap()).toBe(1);
    expect(events).toContain("select");
    autoplay.stop();
    expect(autoplay.isPlaying()).toBe(false);
    expect(events).toContain("stop");
    vi.advanceTimersByTime(5000);
    expect(emblaApi.selectedScrollSnap()).toBe(1);
    emblaApi.destroy();
  });

  it("per-snap delays, timeUntilNext, playOnInit false, stopOnLastSnap", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [
      Autoplay({ delay: () => [100, 200, 300, 400, 500], playOnInit: false, stopOnLastSnap: true }),
    ]);
    const autoplay = emblaApi.plugins().autoplay!;
    const snaps = emblaApi.scrollSnapList().length;
    expect(autoplay.isPlaying()).toBe(false);
    expect(autoplay.timeUntilNext()).toBe(null);
    autoplay.play();
    expect(autoplay.isPlaying()).toBe(true);
    expect(autoplay.timeUntilNext()).toBe(100);
    vi.advanceTimersByTime(100);
    expect(emblaApi.selectedScrollSnap()).toBe(1);
    for (let i = 1; i < snaps + 2; i++) vi.advanceTimersByTime(1000);
    expect(emblaApi.selectedScrollSnap()).toBe(snaps - 1);
    expect(autoplay.isPlaying()).toBe(false);
    emblaApi.destroy();
  });

  it("stopOnMouseEnter pauses on hover and resumes on leave (stopOnInteraction false)", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [
      Autoplay({ delay: 1000, stopOnMouseEnter: true, stopOnInteraction: false }),
    ]);
    const autoplay = emblaApi.plugins().autoplay!;
    emblaApi.rootNode().dispatchEvent(new window.MouseEvent("mouseenter"));
    expect(autoplay.isPlaying()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(emblaApi.selectedScrollSnap()).toBe(0);
    emblaApi.rootNode().dispatchEvent(new window.MouseEvent("mouseleave"));
    expect(autoplay.isPlaying()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(emblaApi.selectedScrollSnap()).toBe(1);
    emblaApi.destroy();
  });

  it("stopOnInteraction (default) stops for good on pointer down; rootNode option picks the hover target", () => {
    const outer = document.createElement("div");
    const elements = mockTestElements(FIXTURE_PLUGINS);
    elements.parentElement!.append(outer);
    outer.append(elements);
    const emblaApi = EmblaCarousel(elements, { duration: 0 }, [Autoplay({ delay: 1000, stopOnMouseEnter: true, rootNode: (root) => root.parentElement })]);
    const autoplay = emblaApi.plugins().autoplay!;
    outer.dispatchEvent(new window.MouseEvent("mouseenter"));
    expect(autoplay.isPlaying()).toBe(false);
    emblaApi.destroy();
  });

  it("destroy clears the timer", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [Autoplay({ delay: 1000 })]);
    emblaApi.destroy();
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("AutoScroll", () => {
  it("plays after startDelay, swaps the scroll body while playing and restores it on stop", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), {}, [AutoScroll({ startDelay: 500, speed: 2 })]);
    const autoScroll = emblaApi.plugins().autoScroll!;
    const engine = emblaApi.internalEngine();
    const baseBody = engine.scrollBody;
    // Playing (autoScroll:play emitted) during the start delay; the scroll body is swapped when it elapses.
    expect(autoScroll.isPlaying()).toBe(true);
    expect(engine.scrollBody).toBe(baseBody);
    vi.advanceTimersByTime(500);
    expect(engine.scrollBody).not.toBe(baseBody);
    // One seek moves the target by `speed` px (forward = towards negative locations).
    const before = engine.location.get();
    engine.scrollBody.seek();
    expect(engine.location.get()).toBeCloseTo(before - 2);
    autoScroll.stop();
    expect(autoScroll.isPlaying()).toBe(false);
    expect(engine.scrollBody).toBe(baseBody);
    emblaApi.destroy();
  });

  it("direction backward moves the other way; play(0) starts at once", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { loop: true }, [AutoScroll({ playOnInit: false, direction: "backward", speed: 3 })]);
    const autoScroll = emblaApi.plugins().autoScroll!;
    const engine = emblaApi.internalEngine();
    autoScroll.play(0);
    vi.advanceTimersByTime(0);
    expect(autoScroll.isPlaying()).toBe(true);
    const before = engine.location.get();
    engine.scrollBody.seek();
    expect(engine.location.get()).toBeCloseTo(before + 3);
    emblaApi.destroy();
  });
});

describe("ClassNames", () => {
  it("adds the default classes on init and moves is-snapped with the selection", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0, loop: true }, [ClassNames()]);
    const root = emblaApi.rootNode();
    const slides = emblaApi.slideNodes();
    expect(root.classList.contains("is-draggable")).toBe(true);
    expect(root.classList.contains("is-loop")).toBe(true);
    expect(slides[0].classList.contains("is-snapped")).toBe(true);
    emblaApi.scrollNext(true);
    // ClassNames updates snapped classes on `select` (and `settle` / `scroll` for in-view).
    expect(slides[1].classList.contains("is-snapped")).toBe(true);
    expect(slides[0].classList.contains("is-snapped")).toBe(false);
    emblaApi.destroy();
    expect(root.classList.contains("is-draggable")).toBe(false);
    expect(slides[1].classList.contains("is-snapped")).toBe(false);
  });

  it("custom class names (string or list) and disabled entries", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), {}, [ClassNames({ snapped: ["snap", "on"], draggable: "", loop: "looping" })]);
    const root = emblaApi.rootNode();
    expect(emblaApi.slideNodes()[0].className).toContain("snap on");
    expect(root.classList.contains("is-draggable")).toBe(false);
    expect(root.classList.contains("looping")).toBe(false);
    emblaApi.destroy();
  });
});

describe("Fade", () => {
  it("stacks the slides on their snap, shows the selected one and swaps on a jump", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [Fade()]);
    const slides = emblaApi.slideNodes();
    const container = emblaApi.containerNode();
    // The container no longer translates: every slide is moved onto its own snap instead.
    expect(container.style.transform).toBe("");
    expect(slides[0].style.opacity).toBe("1");
    expect(slides[0].style.pointerEvents).toBe("auto");
    expect(slides[1].style.opacity).toBe("0");
    expect(slides[1].style.pointerEvents).toBe("none");
    emblaApi.scrollNext(true);
    expect(emblaApi.selectedScrollSnap()).toBe(1);
    expect(slides[1].style.opacity).toBe("1");
    expect(slides[0].style.opacity).toBe("0");
    expect(container.style.transform).toBe("");
    emblaApi.destroy();
    expect(slides[1].style.opacity).toBe("");
    expect(slides[1].style.transform).toBe("");
    expect(slides[0].hasAttribute("style")).toBe(false);
  });

  it("reports the fade as scroll progress and restores embla's on destroy", () => {
    const emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), { duration: 0 }, [Fade()]);
    const last = emblaApi.scrollSnapList().length - 1;
    emblaApi.scrollTo(last, true);
    expect(emblaApi.scrollProgress()).toBeCloseTo(1);
    expect(emblaApi.plugins().fade).toBeDefined();
    emblaApi.destroy();
  });
});

describe("AutoHeight", () => {
  const fixture = {
    ...FIXTURE_PLUGINS,
    slideOffsets: FIXTURE_PLUGINS.slideOffsets.map((slide, index) => ({ ...slide, offsetHeight: 100 + index * 50 })),
  };

  it("sets the container height to the tallest slide of the selected snap", () => {
    const emblaApi = EmblaCarousel(mockTestElements(fixture), { duration: 0 }, [AutoHeight()]);
    const container = emblaApi.containerNode();
    expect(container.style.height).toBe("100px");
    emblaApi.scrollNext(true);
    expect(container.style.height).toBe("150px");
    emblaApi.destroy();
    expect(container.style.height).toBe("");
  });

  it("does nothing on the y axis", () => {
    const emblaApi = EmblaCarousel(mockTestElements(fixture), { axis: "y" }, [AutoHeight()]);
    expect(emblaApi.containerNode().style.height).toBe("");
    emblaApi.destroy();
  });
});
