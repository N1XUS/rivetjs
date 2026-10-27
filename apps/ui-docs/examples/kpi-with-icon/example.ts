import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: with icon",
  summary: "A status-tinted icon next to the title.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-icons .kpi__icon[data-status=danger]",
    },
  ],
});
