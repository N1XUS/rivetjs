import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Lazy load",
  summary:
    "embla's Lazy Load example on the ui Carousel: a photo renders once its slide has been in view (slidesInView, accumulated); a Spinner holds its place.",
  tags: ["carousel", "image"],
  status: "experimental",
  frame: { height: 324, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#carousel-lazy-load-slide-0 > div", "data-loaded", "true"] },
    { attr: ["#carousel-lazy-load-slide-2 > div", "data-loaded", null] },
    { click: "#carousel-lazy-load-next" },
    { attr: ["#carousel-lazy-load-slide-1 > div", "data-loaded", "true"] },
    { matches: "#carousel-lazy-load-slide-1 img" },
    { click: "#carousel-lazy-load-tab-4" },
    { attr: ["#carousel-lazy-load-slide-4 > div", "data-loaded", "true"] },
  ],
});
