import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Free drag",
  summary: "dragFree: the track glides with momentum and stops anywhere instead of snapping.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 192, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      drag: ['#carousel-free-drag [data-index="2"]', '#carousel-free-drag [data-index="0"]'],
    },
    {
      absent: "#carousel-free-drag-prev[disabled]",
    },
  ],
});
