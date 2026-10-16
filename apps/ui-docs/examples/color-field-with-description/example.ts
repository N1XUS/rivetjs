import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: With Description",
  summary: 'ColorField demo "With Description".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=description]" }],
});
