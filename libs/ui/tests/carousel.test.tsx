// DOM-target suite: `Carousel` (Rivet addition: embla-carousel behaviour from `@rivetjs/cdk/carousel`, HeroUI look) on
// happy-dom: index exports + compound parts, BEM classes from the `rv-ui-carousel` context on client-created parts (the parts
// render inside the root's provider: Rivet JSX is eager), `class` merged, live `size` / `placement` / `class` update the same
// nodes, counter / dots / thumbnails follow the cdk state, `onSelect` chained. happy-dom has no layout: the client-rendered
// engine starts and measures no snaps, so the suite writes the snap state itself (`layout`). Engine motion / drag / autoplay:
// `tests-components/carousel.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CarouselStateContext } = await import("@rivetjs/cdk/carousel");
const { useContext } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/carousel/index.ts");
const { Carousel, CarouselRoot, CarouselContent, CarouselItem, CarouselDots, CarouselThumbnails, carouselVariants } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));
const q = (root: ParentNode, selector: string) => root.querySelector(selector) as HTMLElement;
const cls = (root: ParentNode, slot: string) => q(root, `[data-slot="${slot}"]`)?.className ?? "";

test("carousel: index exports", () => {
  assert.equal(Carousel, CarouselRoot);
  assert.equal(Carousel.Root, CarouselRoot);
  assert.equal(Carousel.Content, CarouselContent);
  assert.equal(Carousel.Item, CarouselItem);
  assert.equal(Carousel.Dots, CarouselDots);
  assert.equal(Carousel.Thumbnails, CarouselThumbnails);
  for (const part of ["Previous", "Next", "RotationControl", "Dot", "Thumbnail", "Counter"] as const) assert.equal(typeof Carousel[part], "function");
  assert.equal(carouselVariants().base(), "carousel carousel--horizontal carousel--inside carousel--md");
  assert.equal(
    carouselVariants({ orientation: "vertical", placement: "outside", size: "sm" }).base(),
    "carousel carousel--vertical carousel--outside carousel--sm",
  );
  assert.equal(carouselVariants().dot(), "carousel__dot");
});

type State = import("@rivetjs/cdk/carousel").CarouselState;
let probed: State | undefined;
const probes: State[] = [];
const StateProbe = () => {
  probed = useContext(CarouselStateContext) ?? undefined;
  if (probed) probes.push(probed);
  return null;
};
/** What a measured engine would write: `snaps` snaps of one slide each, `selected` selected. */
const layout = (state: State, snaps: number, selected = 0) => {
  state.slideCount.set(snaps);
  state.slideRegistry.set(Array.from({ length: snaps }, (_, i) => [i]));
  state.snapCount.set(snaps);
  state.selectedIndex.set(selected);
};

test("carousel: client-created parts read the carousel context (classes per part, class merged)", async () => {
  const r = render(() => (
    <Carousel aria-label="Client" size="sm" placement="outside" tabs class="x-root">
      <Carousel.Content class="x-track" viewportClass="x-viewport">
        <Carousel.Item class="x-item">A</Carousel.Item>
        <Carousel.Item>B</Carousel.Item>
        <Carousel.Item>C</Carousel.Item>
      </Carousel.Content>
      <Carousel.Previous id="prev" />
      <Carousel.Next id="next" variant="primary" />
      <Carousel.Dots />
      <Carousel.Counter />
      <StateProbe />
    </Carousel>
  ));
  await flush();
  assert.ok(probed, "parts render inside the cdk state provider");
  layout(probed!, 3);
  await flush();
  const c = r.container;
  assert.equal(cls(c, "carousel"), "carousel carousel--horizontal carousel--outside carousel--sm x-root");
  assert.equal(cls(c, "carousel-viewport"), "carousel__viewport x-viewport");
  assert.equal(cls(c, "carousel-content"), "carousel__content x-track");
  assert.equal(q(c, '[data-slot="carousel-item"]').className, "carousel__item x-item");
  // Size from the context (sm), variant per control.
  assert.equal(q(c, "#prev").className, "button button--icon-only button--sm button--tertiary carousel__control carousel__previous");
  assert.equal(q(c, "#next").className, "button button--icon-only button--sm button--primary carousel__control carousel__next");
  assert.equal(c.querySelectorAll('[data-slot="carousel-dot"]').length, 3);
  assert.equal(cls(c, "carousel-dots"), "carousel__dots");
  assert.equal(q(c, '[data-slot="carousel-dot"]').className, "carousel__dot");
  assert.equal(q(c, '[data-slot="carousel-counter"]').textContent, "1 / 3");
  r.unmount();
});

test("carousel: counter + selected dot follow the selected snap; onSelect is chained", async () => {
  const seen: number[] = [];
  const r = render(() => (
    <Carousel aria-label="Count" tabs onSelect={(i) => seen.push(i)}>
      <Carousel.Content>
        <Carousel.Item>A</Carousel.Item>
        <Carousel.Item>B</Carousel.Item>
        <Carousel.Item>C</Carousel.Item>
      </Carousel.Content>
      <Carousel.Dots />
      <Carousel.Counter separator=" of " />
      <StateProbe />
    </Carousel>
  ));
  await flush();
  const state = probed!;
  layout(state, 3, 2);
  await flush();
  assert.equal(q(r.container, '[data-slot="carousel-counter"]').textContent, "3 of 3");
  assert.equal(r.container.querySelectorAll('[data-slot="carousel-dot"]')[2]!.getAttribute("aria-selected"), "true");
  state.onSelect?.(1);
  assert.deepEqual(seen.slice(-1), [1]);
  r.unmount();
});

test("carousel: thumbnails wrap the preview in a tab; custom thumbnails; rotation control icons", async () => {
  const r = render(() => (
    <div>
      <Carousel aria-label="Thumbs" tabs id="t1">
        <Carousel.Content>
          <Carousel.Item>A</Carousel.Item>
          <Carousel.Item>B</Carousel.Item>
        </Carousel.Content>
        <Carousel.Thumbnails>{(index) => <span class="preview">{`P${index}`}</span>}</Carousel.Thumbnails>
        <StateProbe />
      </Carousel>
      <Carousel aria-label="Custom" tabs id="t2" autoplay={{ playOnInit: false }}>
        <Carousel.Content>
          <Carousel.Item>A</Carousel.Item>
          <Carousel.Item>B</Carousel.Item>
        </Carousel.Content>
        <Carousel.Thumbnails custom>
          {(index) => (
            <Carousel.Thumbnail index={index} class="x-thumb" aria-label={`Photo ${index + 1}`}>
              {`C${index}`}
            </Carousel.Thumbnail>
          )}
        </Carousel.Thumbnails>
        <Carousel.RotationControl id="rot" />
        <StateProbe />
      </Carousel>
    </div>
  ));
  await flush();
  for (const state of probes.slice(-2)) layout(state, 2);
  await flush();
  const first = q(r.container, "#t1");
  const thumbs = first.querySelectorAll('[data-slot="carousel-thumbnail"]');
  assert.equal(thumbs.length, 2);
  assert.equal((thumbs[1] as HTMLElement).className, "carousel__thumbnail");
  assert.equal(thumbs[1]!.getAttribute("role"), "tab");
  assert.equal(q(thumbs[1]!, ".preview").textContent, "P1");
  const second = q(r.container, "#t2");
  const custom = second.querySelectorAll('[data-slot="carousel-thumbnail"]');
  assert.equal((custom[0] as HTMLElement).className, "carousel__thumbnail x-thumb");
  assert.equal(custom[1]!.getAttribute("aria-label"), "Photo 2");
  const rot = q(second, "#rot");
  assert.match(rot.className, /carousel__rotation-control/);
  assert.equal(rot.getAttribute("aria-label"), "Start automatic slide show");
  assert.equal(rot.getAttribute("data-rotating"), null);
  assert.ok(rot.querySelector('[data-slot="carousel-pause-icon"]') && rot.querySelector('[data-slot="carousel-play-icon"]'));
  r.unmount();
});

test("carousel: live size / placement / class update the same nodes", async () => {
  const size = signal<"sm" | "md" | "lg">("md");
  const placement = signal<"inside" | "outside">("inside");
  const extra = signal("a");
  const r = render(() => (
    <Carousel aria-label="Live" size={size()} placement={placement()} class={extra()}>
      <Carousel.Content>
        <Carousel.Item>A</Carousel.Item>
      </Carousel.Content>
      <Carousel.Next id="live-next" />
    </Carousel>
  ));
  await flush();
  const root = q(r.container, '[data-slot="carousel"]');
  const next = q(r.container, "#live-next");
  assert.equal(root.className, "carousel carousel--horizontal carousel--inside carousel--md a");
  size.set("lg");
  placement.set("outside");
  extra.set("b");
  await flush();
  assert.equal(q(r.container, '[data-slot="carousel"]'), root);
  assert.equal(root.className, "carousel carousel--horizontal carousel--outside carousel--lg b");
  assert.equal(q(r.container, "#live-next"), next);
  r.unmount();
});
