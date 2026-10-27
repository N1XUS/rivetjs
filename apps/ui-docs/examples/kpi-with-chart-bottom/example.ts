import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: chart at the bottom",
  summary: "A sparkline that bleeds to the card's bottom edge.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-bottom .kpi__chart svg",
    },
  ],
});
