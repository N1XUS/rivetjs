import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: Render Function",
  summary: 'Tooltip demo "Render Function".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "button:nth-of-type(1)" }, { attr: ["[role=tooltip]", "data-custom", "foo"] }],
});
