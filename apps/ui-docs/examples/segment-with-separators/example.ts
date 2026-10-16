import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: With Separators",
  summary: "Segment.Separator between items; separators next to the selected item fade out.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=segment-item]:nth-of-type(4)" }, { attr: ["[data-slot=segment-item]:nth-of-type(4)", "aria-checked", "true"] }],
});
