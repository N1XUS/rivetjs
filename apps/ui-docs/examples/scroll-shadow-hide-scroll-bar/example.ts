import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: Hide Scroll Bar",
  summary: 'ScrollShadow demo "Hide Scroll Bar".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".scroll-shadow.scroll-shadow--hide-scrollbar" }],
});
