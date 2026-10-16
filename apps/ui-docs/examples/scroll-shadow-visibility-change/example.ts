import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: Visibility Change",
  summary: 'ScrollShadow demo "Visibility Change".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#vertical-state", "bottom"] }],
});
