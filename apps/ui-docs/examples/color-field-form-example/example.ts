import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Form Example",
  summary: 'ColorField demo "Form Example".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["[data-slot=color-input-group-input]", "#22c55e"] },
    { key: "Tab" },
    { click: "button[type=submit]" },
    { expect: ["form button", "Saving..."] },
  ],
});
