import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: Usage",
  summary: 'Tooltip demo "Usage".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "[aria-label='More information']" }, { expect: ["[role=tooltip]", "More information"] }],
});
