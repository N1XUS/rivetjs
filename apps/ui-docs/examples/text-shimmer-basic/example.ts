import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextShimmer: Usage",
  summary: "A light sweep over a short status label while work is in progress.",
  tags: ["text-shimmer"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".text-shimmer[data-active=true]" }],
});
