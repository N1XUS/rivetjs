import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Loading",
  summary: 'Button demo "Loading".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=button]", "data-pending", "true"] }, { matches: "[data-slot=button] [data-slot=spinner]" }],
});
