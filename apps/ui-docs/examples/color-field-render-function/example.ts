import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Render Function",
  summary: 'ColorField demo "Render Function".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-field]", "data-custom", "foo"] }, { attr: ["[data-slot=color-input-group]", "data-custom", "foo"] }],
});
