import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Disabled State",
  summary: 'ColorField demo "Disabled State".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-field]", "data-disabled", "true"] }],
});
