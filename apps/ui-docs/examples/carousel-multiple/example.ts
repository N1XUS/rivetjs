import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Multiple per view",
  summary: "Three slides per view (--rv-carousel-slide-size), aligned to the start, small size with the controls outside.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 206, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#carousel-multiple-next",
    },
    {
      absent: "#carousel-multiple-prev[disabled]",
    },
  ],
});
