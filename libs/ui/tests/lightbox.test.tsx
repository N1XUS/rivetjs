// DOM-target suite: `Lightbox` (Rivet addition: yet-another-react-lightbox behaviour from `@rivetjs/cdk/lightbox`, HeroUI look)
// on happy-dom: index exports + compound parts, a controlled signal opens the modal with the backdrop / dialog / container
// classes (opaque / blur), default parts (Close / Previous / Next with lucide icons), Next moves the counter + captions, Close and
// Escape close (`isOpen` signal back to false), plugin toggles (captions, thumbnails) flip `aria-pressed` and their part, custom
// `Lightbox.Media` fallback for custom slides. Swipe / zoom / media autoplay / focus restore on a real browser:
// `libs/cdk/tests/lightbox*.browser.test.tsx`, `tests-components/lightbox.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/lightbox/index.ts");
const {
  Lightbox,
  LightboxRoot,
  LightboxSlides,
  LightboxMedia,
  LightboxClose,
  LightboxCounter,
  LightboxCaptions,
  LightboxCaptionsToggle,
  LightboxThumbnails,
  LightboxThumbnailsToggle,
  lightboxVariants,
} = ui;

const flush = () => new Promise((r) => setTimeout(r, 30));
const q = (selector: string) => document.querySelector(selector) as HTMLElement | null;
const escape = (target: Element) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const SLIDES = [
  { src: PNG, alt: "One", width: 1, height: 1, title: "First title" },
  { src: PNG, alt: "Two", width: 1, height: 1, title: "Second title" },
  { src: PNG, alt: "Three", width: 1, height: 1 },
];

test("lightbox: index exports + variants", () => {
  assert.equal(Lightbox, LightboxRoot);
  assert.equal(Lightbox.Root, LightboxRoot);
  assert.equal(Lightbox.Slides, LightboxSlides);
  assert.equal(Lightbox.Media, LightboxMedia);
  assert.equal(Lightbox.Close, LightboxClose);
  for (const part of ["Image", "Toolbar", "Button", "Previous", "Next"] as const) assert.equal(typeof Lightbox[part], "function");
  assert.equal(lightboxVariants().backdrop(), "lightbox__backdrop lightbox__backdrop--opaque");
  assert.equal(lightboxVariants({ backdrop: "blur" }).backdrop(), "lightbox__backdrop lightbox__backdrop--blur");
  assert.equal(lightboxVariants().button(), "lightbox__button");
});

test("lightbox: controlled open, default parts, next, Close + Escape close", async () => {
  const open = signal(false);
  const r = render(() => <Lightbox isOpen={open} slides={SLIDES} backdrop="blur" class="x-root" />);
  await flush();
  assert.equal(q("[data-lightbox-root]"), null);
  open.set(true);
  await flush();
  assert.match(q("[data-lightbox-overlay]")!.className, /^lightbox__backdrop lightbox__backdrop--blur$/);
  assert.equal(q("[data-lightbox-root]")!.className, "lightbox x-root");
  const container = q("[role=dialog]")!;
  assert.equal(container.className, "lightbox__container");
  assert.ok(q("[data-slot=lightbox-close-icon]"));
  assert.ok(q("[data-slot=lightbox-previous-icon]"));
  assert.ok(q("[data-slot=lightbox-next-icon]"));
  assert.match(q("[data-action=close]")?.className ?? q("button[aria-label=Close]")!.className, /button--icon-only.*lightbox__button/);
  const current = () => (q("[data-lightbox-slide][data-current] img") as HTMLImageElement | null)?.alt;
  assert.equal(current(), "One");
  (q("button[aria-label=Next]") as HTMLButtonElement).click();
  await flush();
  assert.equal(current(), "Two");
  (q("button[aria-label=Close]") as HTMLButtonElement).click();
  await flush();
  assert.equal(open(), false);
  open.set(true);
  await flush();
  escape(q("[role=dialog]")!);
  await flush();
  assert.equal(open(), false);
  r.unmount();
});

test("lightbox: plugin parts — counter, captions toggle, thumbnails toggle", async () => {
  const open = signal(true);
  const r = render(() => (
    <Lightbox isOpen={open} slides={SLIDES}>
      {() => (
        <>
          <Lightbox.Slides />
          <Lightbox.Toolbar>
            <LightboxCaptionsToggle />
            <LightboxThumbnailsToggle />
            <Lightbox.Close />
          </Lightbox.Toolbar>
          <Lightbox.Previous />
          <Lightbox.Next />
          <LightboxCounter />
          <LightboxCaptions />
          <LightboxThumbnails />
        </>
      )}
    </Lightbox>
  ));
  await flush();
  assert.equal(q(".lightbox__counter")!.textContent, "1 / 3");
  assert.equal(q(".lightbox__captions-title")!.textContent, "First title");
  assert.equal(document.querySelectorAll(".lightbox__thumbnail").length, 3);
  const captionsToggle = q("[data-action=captions]")!;
  assert.equal(captionsToggle.getAttribute("aria-pressed"), "true");
  assert.ok(captionsToggle.querySelector('[data-when="on"] [data-slot=lightbox-captions-icon]'));
  captionsToggle.click();
  await flush();
  assert.equal(captionsToggle.getAttribute("aria-pressed"), "false");
  assert.equal(q(".lightbox__captions"), null);
  // Thumbnail click navigates.
  (document.querySelectorAll(".lightbox__thumbnail")[2] as HTMLButtonElement).click();
  await flush();
  assert.equal(q(".lightbox__counter")!.textContent, "3 / 3");
  q("[data-action=thumbnails]")!.click();
  await flush();
  assert.equal(q(".lightbox__thumbnails"), null);
  r.unmount();
});

test("lightbox: Media fallback renders custom slide types", async () => {
  const open = signal(true);
  const r = render(() => (
    <Lightbox isOpen={open} slides={[{ type: "custom", key: "c1" }]}>
      {() => <Lightbox.Slides>{() => <Lightbox.Media fallback={<p class="x-custom">Custom slide</p>} />}</Lightbox.Slides>}
    </Lightbox>
  ));
  await flush();
  assert.equal(q("[data-lightbox-slide][data-current] .x-custom")?.textContent, "Custom slide");
  r.unmount();
});
