import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: With Line Chart",
  summary: "A line chart comparing two series inside a widget.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#widget-line figure",
    },
  ],
});
