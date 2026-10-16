import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: Always visible",
  summary: 'variant="always" keeps the scrollbars visible; size="sm" makes them thinner.',
  tags: ["scroll-area"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".scroll-area--always .scroll-area__thumb" }, { matches: ".scroll-area--sm" }],
});
