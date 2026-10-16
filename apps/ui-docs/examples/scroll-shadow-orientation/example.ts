import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: Orientation",
  summary: 'ScrollShadow demo "Orientation".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".scroll-shadow--vertical" }, { matches: ".scroll-shadow--horizontal" }],
});
