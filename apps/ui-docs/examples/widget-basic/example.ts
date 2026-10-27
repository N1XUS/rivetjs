import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: Usage",
  summary: "A widget: tinted shell with a header (title, description, legend), a raised content area holding an area chart, and a footer.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#widget-basic [data-slot=widget-title]", "Sessions"],
    },
    {
      matches: "#widget-basic [data-slot=widget-content] figure",
    },
  ],
});
