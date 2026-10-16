import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: Both axes",
  summary: "Content larger than the area on both axes: two scrollbars and the corner between them.",
  tags: ["scroll-area"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="scroll-area"]' }],
});
