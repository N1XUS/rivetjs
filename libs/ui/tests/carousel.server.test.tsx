// Server-target suite: `Carousel` (Rivet addition: embla-carousel behaviour from `@rivetjs/cdk/carousel`, HeroUI look) SSR —
// BEM classes + `data-slot` per part, size / orientation / placement modifiers, W3C APG markup from the cdk (region, slide
// labels, tab list), HeroUI icon-only Button classes + lucide chevrons on the controls (up / down when vertical), rotation
// control with both icons and `data-rotating`, "N / M" counter at `startIndex`, thumbnails as tabs with their preview.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";

const { Carousel } = await import("../index.ts");

const SLIDES = ["One", "Two", "Three", "Four"];

test("carousel SSR: root, viewport, track, items with BEM classes and data-slot", async () => {
  const html = await renderToString(() => (
    <Carousel id="c" aria-label="Gallery" class="custom-root" slideCount={4}>
      <Carousel.Content class="custom-track" viewportClass="custom-viewport">
        {SLIDES.map((s) => (
          <Carousel.Item class="custom-item">{s}</Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
    </Carousel>
  ));
  assert.match(html, /class="carousel carousel--horizontal carousel--inside carousel--md custom-root"/);
  assert.match(html, /data-slot="carousel"/);
  assert.match(html, /role="region"/);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.match(html, /aria-label="Gallery"/);
  assert.match(
    html,
    /class="carousel__viewport custom-viewport"[^>]*data-slot="carousel-viewport"|data-slot="carousel-viewport"[^>]*class="carousel__viewport custom-viewport"/,
  );
  assert.match(html, /class="carousel__content custom-track"/);
  assert.equal((html.match(/class="carousel__item custom-item"/g) ?? []).length, 4);
  assert.match(html, /aria-label="1 of 4"/);
  assert.match(html, /data-slot="carousel-item"/);
  // Controls: HeroUI icon-only tertiary Button classes + the carousel slots, lucide chevrons.
  assert.match(html, /class="button button--icon-only button--md button--tertiary carousel__control carousel__previous"/);
  assert.match(html, /class="button button--icon-only button--md button--tertiary carousel__control carousel__next"/);
  assert.match(html, /aria-label="Previous slide"/);
  assert.match(html, /aria-label="Next slide"/);
  assert.match(html, /data-slot="carousel-previous-icon"/);
  assert.match(html, /data-slot="carousel-next-icon"/);
  // First snap: previous disabled, next enabled (slideCount known on the server).
  assert.match(html, /<button[^>]*disabled[^>]*carousel__previous|carousel__previous[^>]*disabled/);
});

test("carousel SSR: size, placement, orientation modifiers; control variant + size; vertical chevrons", async () => {
  const html = await renderToString(() => (
    <Carousel aria-label="V" size="lg" placement="outside" orientation="vertical" slideCount={2}>
      <Carousel.Content>
        <Carousel.Item>A</Carousel.Item>
        <Carousel.Item>B</Carousel.Item>
      </Carousel.Content>
      <Carousel.Previous variant="secondary" size="sm" />
      <Carousel.Next />
    </Carousel>
  ));
  assert.match(html, /class="carousel carousel--vertical carousel--outside carousel--lg"/);
  assert.match(html, /data-orientation="vertical"/);
  assert.match(html, /class="button button--icon-only button--sm button--secondary carousel__control carousel__previous"/);
  assert.match(html, /class="button button--icon-only button--lg button--tertiary carousel__control carousel__next"/);
  assert.match(html, /flex-direction:\s*column/);
  // lucide chevron-up / chevron-down: their path data differs from left / right (m18 15-6-6-6 6 / m6 9 6 6 6-6).
  assert.match(html, /d="m18 15-6-6-6 6"/);
  assert.match(html, /d="m6 9 6 6 6-6"/);
});

test("carousel SSR: dots tab list, active dot, counter at startIndex", async () => {
  const html = await renderToString(() => (
    <Carousel aria-label="Dots" tabs startIndex={2} slideCount={4}>
      <Carousel.Content>
        {SLIDES.map((s) => (
          <Carousel.Item>{s}</Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Dots />
      <Carousel.Counter class="custom-counter" />
    </Carousel>
  ));
  assert.match(html, /class="carousel__dots"[^>]*data-slot="carousel-dots"|data-slot="carousel-dots"[^>]*class="carousel__dots"/);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/class="carousel__dot"/g) ?? []).length, 4);
  assert.match(html, /aria-selected="true"[^>]*aria-label="Slide 3"|aria-label="Slide 3"[^>]*aria-selected="true"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /<span class="carousel__counter custom-counter" data-slot="carousel-counter">(<!--[^>]*-->)*3(<!--[^>]*-->)* \/ (<!--[^>]*-->)*4/);
});

test("carousel SSR: thumbnails render the preview inside each tab; rotation control with both icons", async () => {
  const html = await renderToString(() => (
    <Carousel aria-label="Thumbs" tabs autoplay slideCount={3}>
      <Carousel.Content>
        <Carousel.Item>A</Carousel.Item>
        <Carousel.Item>B</Carousel.Item>
        <Carousel.Item>C</Carousel.Item>
      </Carousel.Content>
      <Carousel.Thumbnails>{(index) => <img alt="" src={`/t${index}.png`} />}</Carousel.Thumbnails>
      <Carousel.RotationControl />
    </Carousel>
  ));
  assert.match(html, /class="carousel__thumbnails"/);
  assert.equal((html.match(/class="carousel__thumbnail"/g) ?? []).length, 3);
  assert.match(html, /data-slot="carousel-thumbnail"[^>]*>(<!--[^>]*-->)?<img alt="" src="\/t1\.png"/);
  assert.match(html, /class="button button--icon-only button--sm button--tertiary carousel__rotation-control"/);
  assert.match(html, /aria-label="Stop automatic slide show"/);
  assert.match(html, /data-rotating="true"/);
  assert.match(html, /data-slot="carousel-pause-icon"/);
  assert.match(html, /data-slot="carousel-play-icon"/);
  assert.match(html, /data-playing="true"/);
});
