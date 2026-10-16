import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: Horizontal tags",
  summary: "A row of chips scrolled sideways with a horizontal scrollbar.",
  tags: ["scroll-area"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="scroll-area"]' }],
});
