// Behaviour tests (Chromium, client render) for the `@rivetjs/cdk/lightbox/*` plugins. Cases ported from
// yet-another-react-lightbox (test/unit/plugins/{Captions,Counter,Download,Fullscreen,Inline,Share,Slideshow,Thumbnails,
// Video,Zoom}.spec.tsx, v3.32.2, MIT, © Igor Danchenko) where they apply, plus Rivet cases: zoom wheel / pinch /
// double-click / pan / keyboard, video play / pause on navigation, embed lazily mounted, PDF slide, neighbours preloaded.
import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Lightbox, LightboxCarousel, LightboxImage, LightboxNext, LightboxPrevious, LightboxToolbar, type LightboxSlide } from "../lightbox/index.tsx";
import { LightboxCaptions, LightboxCaptionsToggle } from "../lightbox/captions/index.tsx";
import { LightboxCounter } from "../lightbox/counter/index.tsx";
import { LightboxDownload, lightboxCanDownload, lightboxDownloadUrl } from "../lightbox/download/index.tsx";
import { LightboxEmbed, lightboxEmbedUrl } from "../lightbox/embed/index.tsx";
import { LightboxFullscreen } from "../lightbox/fullscreen/index.tsx";
import { LightboxInline } from "../lightbox/inline/index.tsx";
import { LightboxPdf } from "../lightbox/pdf/index.tsx";
import { LightboxShare } from "../lightbox/share/index.tsx";
import { LightboxSlideshow } from "../lightbox/slideshow/index.tsx";
import { LightboxThumbnails, LightboxThumbnailsToggle } from "../lightbox/thumbnails/index.tsx";
import { LightboxVideo } from "../lightbox/video/index.tsx";
import { LightboxZoom, LightboxZoomIn, LightboxZoomOut } from "../lightbox/zoom/index.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
const images = (n = 5, w = 400, h = 300): LightboxSlide[] =>
  Array.from({ length: n }, (_, i) => ({
    src: svg(`image${i + 1}`, w, h),
    alt: `image${i + 1}`,
    width: w,
    height: h,
    title: `Title ${i + 1}`,
    description: `Description ${i + 1}`,
  }));

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const qa = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];
const button = (action: string) => q<HTMLButtonElement>(`[data-action="${action}"]`)!;
const container = () => q<HTMLElement>("[data-lightbox-container]")!;
const currentSlide = () => q<HTMLElement>("[data-lightbox-slide][data-current]")!;
const currentIndex = () => Number(currentSlide().getAttribute("data-index"));
const press = async (action: string) => {
  button(action).click();
  for (let i = 0; i < 3; i++) await flush();
};

async function open(slides: LightboxSlide[], children: () => unknown, props: Record<string, unknown> = {}) {
  const isOpen = signal(true);
  render(() => (
    <Lightbox isOpen={isOpen} slides={slides} {...props}>
      {children as never}
    </Lightbox>
  ));
  for (let i = 0; i < 3; i++) await flush();
  await until(() => !!q("[data-lightbox-container]"));
  await sleep(0);
  return isOpen;
}

const pointer = (target: EventTarget, type: string, x: number, y: number, id = 1, pointerType = "mouse") =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );

/* ------------------------------------------------------------------------------------------------ */

describe("Captions (YARL Captions.spec)", () => {
  it("renders title + description of the current slide and swaps them on navigation", async () => {
    await open(images(), () => (
      <>
        <LightboxCarousel />
        <LightboxCaptions descriptionMaxLines={2} />
        <LightboxNext />
      </>
    ));
    expect(q(".rv-LightboxCaptionsTitle")!.textContent).toBe("Title 1");
    expect(q(".rv-LightboxCaptionsDescription")!.textContent).toBe("Description 1");
    expect(q(".rv-LightboxCaptionsDescription")!.style.webkitLineClamp).toBe("2");
    await press("next");
    expect(q(".rv-LightboxCaptionsTitle")!.textContent).toBe("Title 2");
  });

  it("toggle hides / shows (aria-pressed + label); hidden starts hidden", async () => {
    await open(images(), () => (
      <>
        <LightboxCarousel />
        <LightboxCaptions hidden />
        <LightboxToolbar>
          <LightboxCaptionsToggle hidden />
        </LightboxToolbar>
      </>
    ));
    expect(q("[data-lightbox-captions]")).toBeNull();
    expect(button("captions").getAttribute("aria-label")).toBe("Show captions");
    expect(button("captions").getAttribute("aria-pressed")).toBe("false");
    await press("captions");
    expect(q("[data-lightbox-captions]")).not.toBeNull();
    expect(button("captions").getAttribute("aria-label")).toBe("Hide captions");
    expect(button("captions").getAttribute("aria-pressed")).toBe("true");
  });

  it("renders nothing for slides without captions", async () => {
    await open([{ src: svg("x"), alt: "x" }], () => (
      <>
        <LightboxCarousel />
        <LightboxCaptions />
      </>
    ));
    expect(q("[data-lightbox-captions]")).toBeNull();
  });
});

describe("Counter (YARL Counter.spec)", () => {
  it("shows index / total, aria-hidden, custom separator", async () => {
    await open(images(3), () => (
      <>
        <LightboxCarousel />
        <LightboxCounter separator="of" />
        <LightboxNext />
      </>
    ));
    const counter = q("[data-lightbox-counter]")!;
    expect(counter.textContent).toBe("1 of 3");
    expect(counter.getAttribute("aria-hidden")).toBe("true");
    await press("next");
    expect(counter.textContent).toBe("2 of 3");
  });
});

describe("Download (YARL Download.spec)", () => {
  it("resolves the URL and file name (downloadUrl > download string > download.url > src)", () => {
    expect(lightboxDownloadUrl({ src: "a.jpg" })).toBe("a.jpg");
    expect(lightboxDownloadUrl({ src: "a.jpg", download: "b.jpg" })).toBe("b.jpg");
    expect(lightboxDownloadUrl({ src: "a.jpg", download: { url: "c.jpg" } })).toBe("c.jpg");
    expect(lightboxDownloadUrl({ src: "a.jpg", downloadUrl: "d.jpg", download: "b.jpg" })).toBe("d.jpg");
    expect(lightboxCanDownload({ src: "a.jpg", download: false })).toBe(false);
    expect(lightboxCanDownload({ type: "custom" })).toBe(false);
    expect(lightboxCanDownload({ type: "custom" }, () => {})).toBe(true);
  });

  it("downloads the current slide through an <a download>; disabled when not downloadable", async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "dispatchEvent").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download}|${this.href.slice(0, 10)}`);
      return true;
    });
    const onDownload = vi.fn();
    const slides = images(2);
    slides[0] = { ...slides[0]!, downloadFilename: "first.svg" };
    slides[1] = { ...slides[1]!, download: false };
    await open(slides, () => (
      <>
        <LightboxCarousel />
        <LightboxDownload onDownload={onDownload} />
        <LightboxNext />
      </>
    ));
    await press("download");
    expect(clicks).toEqual(["first.svg|data:image"]);
    expect(onDownload).toHaveBeenCalledWith({ index: 0 });
    await press("next");
    expect(button("download").disabled).toBe(true);
  });

  it("custom download function gets the slide and saveAs", async () => {
    const download = vi.fn();
    await open([{ type: "custom", key: "c" }], () => (
      <>
        <LightboxCarousel>{() => <div>custom</div>}</LightboxCarousel>
        <LightboxDownload download={(p) => download(p.slide.key, typeof p.saveAs)} />
      </>
    ));
    await press("download");
    expect(download).toHaveBeenCalledWith("c", "function");
  });
});

describe("Share (YARL Share.spec)", () => {
  it("shares the current slide through the Web Share API", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      await open(images(2), () => (
        <>
          <LightboxCarousel />
          <LightboxShare />
        </>
      ));
      expect(button("share").hidden).toBe(false);
      await press("share");
      expect((share.mock.calls[0] as unknown as [ShareData])[0].url!.startsWith("data:image/svg")).toBe(true);
    } finally {
      delete (navigator as { share?: unknown }).share;
    }
  });

  it("hidden without the Web Share API; disabled for share: false", async () => {
    const had = "share" in navigator;
    if (had) Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    await open([{ src: svg("x"), share: false }], () => (
      <>
        <LightboxCarousel />
        <LightboxShare />
        <LightboxShare share={() => {}} class="custom" />
      </>
    ));
    expect(q<HTMLButtonElement>(".rv-LightboxButton[data-action=share]")!.hidden).toBe(true);
    expect(q<HTMLButtonElement>(".custom")!.hidden).toBe(false);
    expect(q<HTMLButtonElement>(".custom")!.disabled).toBe(true);
  });
});

describe("Fullscreen (YARL Fullscreen.spec)", () => {
  it("enters / exits fullscreen on the lightbox root; label + aria-pressed follow fullscreenchange", async () => {
    let fullscreen: Element | null = null;
    vi.spyOn(document, "fullscreenElement", "get").mockImplementation(() => fullscreen);
    vi.spyOn(Element.prototype, "requestFullscreen").mockImplementation(function (this: Element) {
      fullscreen = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    vi.spyOn(document, "exitFullscreen").mockImplementation(() => {
      fullscreen = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    await open(images(2), () => (
      <>
        <LightboxCarousel />
        <LightboxFullscreen />
      </>
    ));
    expect(button("fullscreen").getAttribute("aria-label")).toBe("Enter Fullscreen");
    await press("fullscreen");
    expect(fullscreen === q("[data-lightbox-root]")).toBe(true);
    expect(button("fullscreen").getAttribute("aria-label")).toBe("Exit Fullscreen");
    expect(button("fullscreen").getAttribute("aria-pressed")).toBe("true");
    await press("fullscreen");
    expect(fullscreen === null).toBe(true);
    expect(button("fullscreen").getAttribute("aria-pressed")).toBe("false");
  });

  it("auto enters on open", async () => {
    const request = vi.spyOn(Element.prototype, "requestFullscreen").mockImplementation(() => Promise.resolve());
    await open(images(2), () => (
      <>
        <LightboxCarousel />
        <LightboxFullscreen auto />
      </>
    ));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("Slideshow (YARL Slideshow.spec)", () => {
  it("plays with the delay, pauses, stops at the end of a finite carousel", async () => {
    const onStart = vi.fn(),
      onStop = vi.fn();
    await open(
      images(3),
      () => (
        <>
          <LightboxCarousel />
          <LightboxSlideshow delay={100} onStart={onStart} onStop={onStop} />
        </>
      ),
      { carousel: { finite: true } },
    );
    expect(button("slideshow").getAttribute("aria-label")).toBe("Play");
    await press("slideshow");
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(button("slideshow").getAttribute("aria-label")).toBe("Pause");
    expect(q("[data-lightbox-carousel]")!.getAttribute("aria-live")).toBe("off");
    await until(() => currentIndex() === 1);
    await until(() => currentIndex() === 2);
    await until(() => button("slideshow").getAttribute("aria-pressed") === "false");
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(button("slideshow").disabled).toBe(true);
  });

  it("autoplay starts on open; pause stops advancing", async () => {
    await open(images(4), () => (
      <>
        <LightboxCarousel />
        <LightboxSlideshow autoplay delay={80} />
      </>
    ));
    await until(() => currentIndex() === 1);
    await press("slideshow");
    const index = currentIndex();
    await sleep(250);
    expect(currentIndex()).toBe(index);
  });

  it("waits for a playing video to end", async () => {
    let paused = false;
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
    vi.spyOn(HTMLMediaElement.prototype, "ended", "get").mockImplementation(() => false);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    await open([{ type: "video", sources: [{ src: "v.mp4", type: "video/mp4" }] }, ...images(2)], () => (
      <>
        <LightboxCarousel>{(slide) => (slide.type === "video" ? <LightboxVideo /> : <LightboxImage />)}</LightboxCarousel>
        <LightboxSlideshow delay={50} />
      </>
    ));
    await press("slideshow");
    await sleep(200);
    expect(currentIndex()).toBe(0);
    paused = true;
    q("video")!.dispatchEvent(new Event("ended"));
    await until(() => currentIndex() === 1);
  });
});

describe("Thumbnails (YARL Thumbnails.spec)", () => {
  it("renders a thumbnail per slide, marks the current one, navigates on click", async () => {
    await open(images(5), () => (
      <>
        <LightboxCarousel />
        <LightboxThumbnails width={60} height={40} />
      </>
    ));
    const thumbs = qa<HTMLButtonElement>("[data-lightbox-thumbnail]");
    expect(thumbs.length).toBe(5);
    expect(thumbs[0]!.getAttribute("aria-current")).toBe("true");
    expect(thumbs[3]!.getAttribute("aria-label")).toBe("Go to slide 4");
    expect(thumbs[0]!.style.width).toBe(`${60 + 2 * (1 + 4)}px`);
    thumbs[3]!.click();
    for (let i = 0; i < 3; i++) await flush();
    expect(currentIndex()).toBe(3);
    expect(thumbs[3]!.getAttribute("aria-current")).toBe("true");
    expect(thumbs[0]!.hasAttribute("aria-current")).toBe(false);
  });

  it("takes its grid area (carousel shrinks), uses thumbnail / poster / render for non-images", async () => {
    await open(
      [
        { src: svg("a"), thumbnail: "/thumb.png" },
        { type: "video", sources: [], poster: "/poster.png" },
        { type: "pdf", src: "doc.pdf" },
      ],
      () => (
        <>
          <LightboxCarousel>{() => null}</LightboxCarousel>
          <LightboxThumbnails position="end">{(slide) => <span class="icon">{slide.type}</span>}</LightboxThumbnails>
        </>
      ),
    );
    const strip = q("[data-lightbox-thumbnails]")!;
    expect(strip.style.gridArea).toContain("end");
    const carousel = q("[data-lightbox-carousel]")!;
    expect(carousel.getBoundingClientRect().right <= strip.getBoundingClientRect().left + 0.5).toBe(true);
    const thumbs = qa("[data-lightbox-thumbnail]");
    expect(thumbs[0]!.querySelector("img")!.getAttribute("src")).toBe("/thumb.png");
    expect(thumbs[1]!.querySelector("img")!.getAttribute("src")).toBe("/poster.png");
    expect(thumbs[2]!.querySelector(".icon")!.textContent).toBe("pdf");
  });

  it("toggle hides / shows the strip", async () => {
    await open(images(2), () => (
      <>
        <LightboxCarousel />
        <LightboxThumbnails hidden />
        <LightboxThumbnailsToggle hidden />
      </>
    ));
    expect(q("[data-lightbox-thumbnails]")).toBeNull();
    await press("thumbnails");
    expect(q("[data-lightbox-thumbnails]")).not.toBeNull();
    expect(button("thumbnails").getAttribute("aria-label")).toBe("Hide thumbnails");
  });
});

describe("Video (YARL Video.spec)", () => {
  const video: LightboxSlide = {
    type: "video",
    width: 1280,
    height: 720,
    poster: "/poster.png",
    sources: [{ src: "movie.mp4", type: "video/mp4" }],
    controlsList: "nodownload",
  };

  it("renders <video> with sources, poster, controls, playsInline, options", async () => {
    await open([video], () => <LightboxCarousel>{() => <LightboxVideo loop />}</LightboxCarousel>);
    const el = q<HTMLVideoElement>("video")!;
    expect(el.controls).toBe(true);
    expect(el.playsInline).toBe(true);
    expect(el.loop).toBe(true);
    expect(el.getAttribute("poster")).toBe("/poster.png");
    expect(el.getAttribute("controlslist")).toBe("nodownload");
    expect(el.querySelector("source")!.getAttribute("src")).toBe("movie.mp4");
    expect(el.style.aspectRatio).toBe("1280 / 720");
  });

  it("autoplays when viewed, pauses when left; neighbours never play", async () => {
    const played: string[] = [];
    const paused = new WeakMap<HTMLMediaElement, boolean>();
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) {
      return paused.get(this) ?? true;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, false);
      played.push(this.closest("[data-lightbox-slide]")!.getAttribute("data-index")!);
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, true);
    });
    const slides = [video, { ...video, key: "v2" }, ...images(1)];
    await open(slides, () => (
      <>
        <LightboxCarousel>{(slide) => (slide.type === "video" ? <LightboxVideo autoPlay /> : <LightboxImage />)}</LightboxCarousel>
        <LightboxNext />
      </>
    ));
    await until(() => played.length === 1);
    expect(played).toEqual(["0"]);
    expect(qa("video").length).toBe(2);
    await press("next");
    await until(() => played.length === 2);
    expect(played).toEqual(["0", "1"]);
    expect(pause).toHaveBeenCalledTimes(1);
    await press("next");
    await flush();
    expect(pause).toHaveBeenCalledTimes(2);
  });
});

describe("Embed (Rivet)", () => {
  const youtube: LightboxSlide = {
    type: "embed",
    provider: "youtube",
    id: "abc123",
    title: "A video",
    poster: "/poster.png",
    start: 12.5,
    autoPlay: true,
    muted: true,
  };

  it("builds youtube-nocookie / vimeo dnt / iframe URLs", () => {
    expect(lightboxEmbedUrl(youtube as never)).toBe("https://www.youtube-nocookie.com/embed/abc123?rel=0&playsinline=1&autoplay=1&mute=1&start=12");
    expect(lightboxEmbedUrl({ type: "embed", provider: "vimeo", id: "42", title: "v", start: 3 })).toBe("https://player.vimeo.com/video/42?dnt=1#t=3s");
    expect(lightboxEmbedUrl({ type: "embed", src: "https://example.com/x", title: "x" })).toBe("https://example.com/x");
  });

  it("mounts the iframe only while current (poster for neighbours); leaving unmounts it", async () => {
    await open([...images(1), youtube, ...images(1)], () => (
      <>
        <LightboxCarousel>{(slide) => (slide.type === "embed" ? <LightboxEmbed /> : <LightboxImage />)}</LightboxCarousel>
        <LightboxNext />
      </>
    ));
    expect(q("iframe")).toBeNull();
    expect(q(".rv-LightboxEmbedPoster")!.getAttribute("src")).toBe("/poster.png");
    await press("next");
    const frame = q<HTMLIFrameElement>("iframe")!;
    expect(frame.title).toBe("A video");
    expect(frame.src.startsWith("https://www.youtube-nocookie.com/embed/abc123")).toBe(true);
    expect(frame.getAttribute("allow")).toContain("autoplay");
    await press("next");
    expect(q("iframe")).toBeNull();
  });
});

describe("PDF (Rivet)", () => {
  it("renders the native viewer with a link fallback, mounted for current + neighbours only", async () => {
    const pdf: LightboxSlide = { type: "pdf", src: "/doc.pdf", title: "Doc" };
    const slides = [pdf, ...images(3), { ...pdf, key: "far", src: "/far.pdf" }, ...images(2)];
    await open(slides, () => <LightboxCarousel>{(slide) => (slide.type === "pdf" ? <LightboxPdf /> : <LightboxImage />)}</LightboxCarousel>);
    const objects = qa<HTMLObjectElement>("object");
    expect(objects.length).toBe(1);
    expect(objects[0]!.getAttribute("data")).toBe("/doc.pdf");
    expect(objects[0]!.type).toBe("application/pdf");
    expect(objects[0]!.getAttribute("aria-label")).toBe("Doc");
    const link = objects[0]!.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/doc.pdf");
    expect(link.textContent).toBe("Doc");
  });
});

describe("Inline (YARL Inline.spec)", () => {
  it("renders in place: no dialog, no close, navigation works, nothing focused", async () => {
    render(() => <LightboxInline slides={images(3)} style={{ width: "400px", height: "300px" }} />);
    for (let i = 0; i < 3; i++) await flush();
    const root = q("[data-lightbox-inline]")!;
    expect(root.tagName).toBe("SECTION");
    expect(root.getAttribute("aria-label")).toBe("Photo gallery");
    expect(q("[data-lightbox-overlay]")).toBeNull();
    expect(container().hasAttribute("role")).toBe(false);
    expect(q('[data-action="close"]')).toBeNull();
    expect(document.activeElement === document.body).toBe(true);
    await press("next");
    expect(currentIndex()).toBe(1);
  });
});

describe("Zoom (YARL Zoom.spec)", () => {
  const big = (n = 3) => images(n, 4000, 3000);
  const zoomed = () => q<HTMLElement>("[data-lightbox-slide][data-current] img")!.style.transform;
  const scale = () => Number(/scale\(([\d.]+)\)/.exec(zoomed())?.[1] ?? 1);
  const parts = () => (
    <>
      <LightboxCarousel />
      <LightboxZoom />
      <LightboxToolbar>
        <LightboxZoomIn />
        <LightboxZoomOut />
      </LightboxToolbar>
      <LightboxPrevious />
      <LightboxNext />
    </>
  );
  const loaded = () => until(() => !button("zoom-in").disabled);

  it("zoom in / out buttons (disabled at the limits); navigation resets zoom", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    expect(button("zoom-out").disabled).toBe(true);
    await press("zoom-in");
    expect(scale()).toBe(2);
    expect(button("zoom-out").disabled).toBe(false);
    await press("zoom-out");
    expect(zoomed()).toBe("");
    await press("zoom-in");
    await press("next");
    await sleep(0);
    expect(currentIndex()).toBe(1);
    expect(button("zoom-out").disabled).toBe(true);
  });

  it("disabled for small images (maxZoom = natural / rendered size)", async () => {
    await open(images(1, 20, 15), parts);
    await sleep(100);
    expect(button("zoom-in").disabled).toBe(true);
  });

  it("Ctrl + wheel zooms; wheel pans while zoomed; keyboard + / - / Ctrl+0", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    const img = q("[data-lightbox-slide][data-current] img")!;
    const r = container().getBoundingClientRect();
    img.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }),
    );
    expect(scale()).toBe(2);
    img.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 40, deltaY: 0 }));
    expect(zoomed()).toMatch(/translateX\(-\d/);
    expect(currentIndex()).toBe(0);
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true, cancelable: true }));
    expect(scale()).toBe(4);
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true, cancelable: true }));
    expect(scale()).toBe(2);
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "0", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(zoomed()).toBe("");
  });

  it("arrow keys pan while zoomed instead of navigating", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    await press("zoom-in");
    container().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await flush();
    expect(currentIndex()).toBe(0);
    expect(zoomed()).toMatch(/translateX\(-50px\)/);
  });

  it("double click zooms in (stops) and back out at max", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    const img = q("[data-lightbox-slide][data-current] img")!;
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const dbl = async () => {
      pointer(img, "pointerdown", x, y);
      pointer(img, "pointerup", x, y);
      await sleep(30);
      pointer(img, "pointerdown", x, y);
      pointer(img, "pointerup", x, y);
      await flush();
      await sleep(600);
    };
    await dbl();
    expect(scale() > 1).toBe(true);
    await dbl();
    await dbl();
    expect(zoomed()).toBe("");
  });

  it("drag pans while zoomed (no swipe)", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    await press("zoom-in");
    const img = q("[data-lightbox-slide][data-current] img")!;
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    pointer(img, "pointerdown", x, y);
    for (let i = 1; i <= 5; i++) pointer(img, "pointermove", x + 20 * i, y);
    pointer(img, "pointerup", x + 100, y);
    await flush();
    await sleep(50);
    expect(currentIndex()).toBe(0);
    expect(zoomed()).toMatch(/translateX\(50px\)/);
  });

  it("pinch zooms with two touch pointers", async () => {
    await open(big(), parts, { animation: { zoom: 0 } });
    await loaded();
    const img = q("[data-lightbox-slide][data-current] img")!;
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    pointer(img, "pointerdown", x - 20, y, 1, "touch");
    pointer(img, "pointerdown", x + 20, y, 2, "touch");
    for (let i = 1; i <= 4; i++) {
      pointer(img, "pointermove", x - 20 - 15 * i, y, 1, "touch");
      pointer(img, "pointermove", x + 20 + 15 * i, y, 2, "touch");
    }
    pointer(img, "pointerup", x - 80, y, 1, "touch");
    pointer(img, "pointerup", x + 80, y, 2, "touch");
    await flush();
    expect(scale() > 1.5).toBe(true);
    expect(currentIndex()).toBe(0);
  });
});
