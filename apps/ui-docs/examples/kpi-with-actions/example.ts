import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: with actions",
  summary: "A menu button in the corner (your own Button or Dropdown).",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-actions .kpi__actions button[aria-label='More actions']",
    },
  ],
});
