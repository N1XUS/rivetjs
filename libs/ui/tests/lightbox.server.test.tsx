// Server-target suite: `Lightbox` (Rivet addition: yet-another-react-lightbox behaviour from `@rivetjs/cdk/lightbox`, HeroUI
// look) SSR — a closed modal lightbox renders only the overlay anchor (no slides, no media requests); `LightboxInline` renders
// BEM classes per part, HeroUI icon-only Button classes + lucide icons on the controls, the media switch by slide type
// (image / video / embed poster / PDF object), counter, captions and thumbnails with type icons.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";

const ui = await import("../index.ts");
const { Lightbox, LightboxInline, LightboxCounter, LightboxCaptions, LightboxThumbnails, LightboxZoomIn, LightboxDownload, LightboxSlideshow } = ui;

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

const SLIDES = [
  { src: PNG, alt: "First", width: 1, height: 1, title: "Mountains", description: "Morning light" },
  { type: "video" as const, poster: "/poster.png", width: 640, height: 360, sources: [{ src: "/clip.mp4", type: "video/mp4" }] },
  { type: "embed" as const, provider: "youtube" as const, id: "aqz-KE-bpKQ", poster: "/thumb.png", title: "Embed" },
  { type: "pdf" as const, src: "/doc.pdf", title: "Spec sheet" },
];

test("lightbox SSR: closed modal renders no slides and no media", async () => {
  const html = await renderToString(() => <Lightbox slides={SLIDES} />);
  assert.doesNotMatch(html, /lightbox__slide/);
  assert.doesNotMatch(html, /<img|<video|<iframe|<object/);
});

test("lightbox SSR: inline default parts — classes, slide labels, controls with lucide icons", async () => {
  const html = await renderToString(() => <LightboxInline slides={SLIDES} class="x-inline" aria-label="Gallery" />);
  assert.match(html, /class="lightbox__inline x-inline"/);
  assert.match(html, /aria-label="Gallery"/);
  assert.match(html, /class="lightbox__container"/);
  assert.match(html, /class="lightbox__carousel"/);
  assert.match(html, /class="lightbox__slide"/);
  assert.match(html, /class="lightbox__image"/);
  assert.match(html, /alt="First"/);
  assert.match(html, /class="button button--icon-only button--md button--tertiary lightbox__button lightbox__previous"/);
  assert.match(html, /class="button button--icon-only button--md button--tertiary lightbox__button lightbox__next"/);
  assert.match(html, /data-slot="lightbox-previous-icon"/);
  assert.match(html, /data-slot="lightbox-next-icon"/);
  // Inline: no Close button.
  assert.doesNotMatch(html, /data-slot="lightbox-close-icon"/);
  // Embed: never an iframe on the server unless current; the video neighbour preloads as <video>.
  assert.doesNotMatch(html, /<iframe/);
});

test("lightbox SSR: media switch by type (video, embed poster, PDF object)", async () => {
  const at = async (index: number) => renderToString(() => <LightboxInline slides={SLIDES} index={index} carousel={{ preload: 0 }} />);
  assert.match(await at(1), /<video[^>]*class="lightbox__video"/);
  const embed = await at(2);
  assert.match(embed, /<iframe[^>]*class="lightbox__embed"/);
  assert.match(embed, /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/);
  const pdf = await at(3);
  assert.match(pdf, /<object[^>]*class="lightbox__pdf"/);
  assert.match(pdf, /type="application\/pdf"/);
  assert.match(pdf, /class="lightbox__pdf-fallback"/);
  assert.match(pdf, /data-slot="lightbox-pdf-icon"/);
  assert.match(pdf, /Spec sheet/);
});

test("lightbox SSR: plugin parts — counter, captions, thumbnails with type icons, toolbar buttons", async () => {
  const html = await renderToString(() => (
    <LightboxInline slides={SLIDES}>
      {() => (
        <>
          <Lightbox.Slides />
          <Lightbox.Toolbar>
            <LightboxZoomIn />
            <LightboxDownload />
            <LightboxSlideshow />
          </Lightbox.Toolbar>
          <LightboxCounter />
          <LightboxCaptions />
          <LightboxThumbnails />
        </>
      )}
    </LightboxInline>
  ));
  assert.match(html, /class="lightbox__toolbar"/);
  assert.match(html, /data-slot="lightbox-zoom-in-icon"/);
  assert.match(html, /data-slot="lightbox-download-icon"/);
  assert.match(html, /data-when="off"[^]*data-slot="lightbox-play-icon"/);
  assert.match(html, /data-when="on"[^]*data-slot="lightbox-pause-icon"/);
  assert.match(html, /class="lightbox__counter"[^>]*>1 \/ 4</);
  assert.match(html, /class="lightbox__captions"/);
  assert.match(html, /class="lightbox__captions-title"[^>]*>Mountains</);
  assert.match(html, /class="lightbox__captions-description"[^>]*>Morning light</);
  assert.match(html, /class="lightbox__thumbnails"/);
  assert.equal((html.match(/class="lightbox__thumbnail"/g) ?? []).length, 4);
  // PDF thumbnail (no image) = lucide FileText icon.
  assert.match(html, /class="lightbox__thumbnail-icon"/);
});
