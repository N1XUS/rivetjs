import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Variable widths",
  summary: "embla's Variable Widths example: each item sets its own --rv-carousel-slide-size; embla measures every slide and snaps to each one.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 240, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#carousel-variable-widths-counter", "1 / "] },
    { click: "#carousel-variable-widths-next" },
    { expect: ["#carousel-variable-widths-counter", "2 / "] },
  ],
});
