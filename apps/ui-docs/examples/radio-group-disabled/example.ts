import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Disabled",
  summary: 'RadioGroup demo "Disabled".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=radio-group]", "data-disabled", "true"] }],
});
