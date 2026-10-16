import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Slides to scroll",
  summary: 'embla\'s Slides To Scroll example: slidesToScroll="auto" groups as many slides as fit (two at 50%) into one snap.',
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#carousel-slides-to-scroll-next" },
    { attr: ["#carousel-slides-to-scroll-slide-2", "data-snapped", "true"] },
    { attr: ["#carousel-slides-to-scroll-slide-3", "data-snapped", "true"] },
    { matches: "#carousel-slides-to-scroll-tab-4" },
    { absent: "#carousel-slides-to-scroll-tab-5" },
  ],
});
