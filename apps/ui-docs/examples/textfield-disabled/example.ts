import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Disabled State",
  summary: 'TextField demo "Disabled State".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=textfield]", "data-disabled", "true"] }],
});
