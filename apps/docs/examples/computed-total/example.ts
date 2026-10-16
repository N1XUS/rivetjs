import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Computed total",
  summary: "A small cart: the item count and the total are computed from the quantities and update on every change.",
  tags: ["signals", "computed"],
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#total", "$13.20"] },
    { click: "#add-tea" },
    { expect: ["#total", "$17.60"] },
    { click: "#remove-cake" },
    { expect: ["#total", "$8.80"] },
  ],
});
