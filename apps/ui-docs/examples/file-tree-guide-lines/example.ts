import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Guide Lines",
  summary: 'showGuideLines draws a line per nesting level: true (default), "hover" (while hovered or focused) or false.',
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["[aria-label='Guide lines Off']", "data-guide-lines", "none"],
    },
  ],
});
