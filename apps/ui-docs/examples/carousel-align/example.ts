import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Align",
  summary: "embla's Align example: 70% slides centred (align default) with containScroll off, so the first and last snaps leave space at the edges.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-align-slide-0", "data-snapped", "true"] },
    { click: "#carousel-align-next" },
    { attr: ["#carousel-align-slide-1", "data-snapped", "true"] },
  ],
});
