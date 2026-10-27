import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: With Table",
  summary: "Non-chart content: a secondary Table drops its own background and lets Widget.Content (without padding) be the surface.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#widget-table", "Fabrikam"],
    },
  ],
});
