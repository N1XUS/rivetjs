import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Controlled",
  summary: 'CheckboxGroup demo "Controlled".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=checkbox-group]", "Selected: coding, design"] }],
});
