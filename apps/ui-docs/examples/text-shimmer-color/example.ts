import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextShimmer: Color",
  summary: "The shimmer follows `currentColor`, so text colour and size utilities style it; `isActive` turns the sweep off.",
  tags: ["text-shimmer"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".text-success[data-active=true]" }, { click: "#shimmer-toggle" }, { matches: ".text-success[data-active=false]" }],
});
