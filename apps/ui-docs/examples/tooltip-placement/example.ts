import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: Placement",
  summary: 'Tooltip demo "Placement".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "button:nth-of-type(3)" }, { expect: ["[role=tooltip]", "Right placement"] }, { matches: "[role=tooltip][data-placement=right]" }],
});
