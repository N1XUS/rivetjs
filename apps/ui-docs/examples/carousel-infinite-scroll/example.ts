import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Infinite scroll",
  summary:
    "embla's Infinite Scroll example on the ui Carousel: reaching the last slide loads five more (mocked, up to 20); a custom watchSlides keeps the momentum.",
  tags: ["carousel", "infinite"],
  status: "experimental",
  frame: { height: 240, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-infinite-scroll", "data-ready", "true"] },
    { attr: ["#carousel-infinite-scroll-slide-0", "aria-label", "1 of 5"] },
    { click: "#carousel-infinite-scroll-next" },
    { click: "#carousel-infinite-scroll-next" },
    { click: "#carousel-infinite-scroll-next" },
    { click: "#carousel-infinite-scroll-next" },
    { click: "#carousel-infinite-scroll-next" },
    { attr: ["#carousel-infinite-scroll-loader", "data-loading", "true"] },
    { matches: "#carousel-infinite-scroll-slide-9" },
    { attr: ["#carousel-infinite-scroll-slide-0", "aria-label", "1 of 10"] },
  ],
});
