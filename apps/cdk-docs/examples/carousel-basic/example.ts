import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel with previous and next buttons",
  summary: "A Carousel of five slides from items: drag, swipe or use the buttons and arrow keys; embla's motion eases each slide into place.",
  tags: ["carousel", "tailwind", "drag"],
  status: "experimental",
  frame: { height: 240, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#gallery", "aria-roledescription", "carousel"] },
    { name: ["#gallery", "Landscapes"] },
    { attr: ["#gallery-slide-0", "aria-label", "1 of 5"] },
    { attr: ["#gallery-slide-0", "data-snapped", "true"] },
    { attr: ["#prev", "data-disabled", "true"] },
    { name: ["#next", "Next slide"] },
    { click: "#next" },
    { attr: ["#gallery-slide-1", "data-snapped", "true"] },
    { attr: ["#prev", "data-disabled", null] },
    { press: ["#next", "ArrowRight"] },
    { attr: ["#gallery-slide-2", "data-snapped", "true"] },
    { drag: ["#gallery-slide-2", "#prev"] },
    { attr: ["#gallery", "data-dragging", null] },
  ],
});
