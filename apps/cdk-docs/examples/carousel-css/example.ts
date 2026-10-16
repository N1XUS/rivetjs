import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel with plain CSS",
  summary:
    "styles.css targets .rv-Carousel and its parts with data-snapped / data-dragging / data-disabled; --rv-carousel-slide-size shows a peek of the next slide.",
  tags: ["carousel", "css", "styling"],
  status: "experimental",
  frame: { height: 209, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#colors", "class", "rv-Carousel"] },
    { attr: ["#colors-viewport", "class", "rv-CarouselViewport"] },
    { attr: ["#colors-slide-0", "data-snapped", "true"] },
    { click: "#next" },
    { attr: ["#colors-slide-1", "data-snapped", "true"] },
    { attr: ["#colors-slide-0", "data-snapped", null] },
  ],
});
