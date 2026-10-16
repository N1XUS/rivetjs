import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Fieldset: Usage",
  summary: 'Fieldset demo "Usage".',
  tags: ["fieldset"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "fieldset.fieldset legend.fieldset__legend" }],
});
