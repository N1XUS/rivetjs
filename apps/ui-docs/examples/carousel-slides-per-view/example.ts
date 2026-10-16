import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Slides per view",
  summary: "embla's Slides Per View example: one slide on small screens, two from sm and three from lg; embla re-measures on resize and the dots follow.",
  tags: ["carousel", "responsive"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-slides-per-view-slide-0", "data-snapped", "true"] },
    { click: "#carousel-slides-per-view-next" },
    { attr: ["#carousel-slides-per-view-tab-1", "aria-selected", "true"] },
  ],
});
