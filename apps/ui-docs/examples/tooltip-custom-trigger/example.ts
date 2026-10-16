import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: Custom Triggers",
  summary: 'Tooltip demo "Custom Triggers".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "[aria-label='Status chip']" }, { expect: ["[role=tooltip]", "Jane is currently online"] }],
});
