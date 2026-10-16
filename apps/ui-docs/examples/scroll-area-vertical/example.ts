import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: Vertical list",
  summary: "A 50-tag list in a fixed-height ScrollArea: overlay scrollbar while hovered, native wheel / touch / keyboard scrolling.",
  tags: ["scroll-area"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "[data-slot=scroll-area-viewport]" }, { matches: "[data-slot=scroll-area-thumb]" }],
});
