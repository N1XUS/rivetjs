import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: with footer",
  summary: "A separator and a footer with a link to the report.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-footer .kpi__separator",
    },
  ],
});
