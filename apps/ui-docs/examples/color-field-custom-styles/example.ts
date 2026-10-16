import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Tailwind CSS",
  summary: 'ColorField demo "Tailwind CSS".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-input-group].rounded-xl" }],
});
