import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: inline chart",
  summary: "Value and sparkline side by side.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-inline svg",
    },
  ],
});
