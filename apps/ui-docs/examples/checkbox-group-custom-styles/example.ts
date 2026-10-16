import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Tailwind CSS",
  summary: 'CheckboxGroup demo "Tailwind CSS".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox-control].bg-success-soft" }],
});
