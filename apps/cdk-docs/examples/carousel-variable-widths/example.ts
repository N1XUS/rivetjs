import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slides of variable widths",
  summary: "embla's Variable Widths example: each slide sets its own --rv-carousel-slide-size; embla measures every slide and snaps to each one.",
  tags: ["carousel", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ expect: ["#snap", "1 / "] }, { click: "#next" }, { expect: ["#snap", "2 / "] }, { attr: ["#widths-slide-1", "data-snapped", "true"] }],
});
