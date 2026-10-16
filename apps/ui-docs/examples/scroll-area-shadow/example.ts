import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: With shadow",
  summary: "shadow fades the scrolled-away edges of the viewport (ScrollShadow, CSS scroll-driven).",
  tags: ["scroll-area"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '.scroll-area__viewport.scroll-shadow[data-scroll-shadow-mode="auto"]' }],
});
