import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Tailwind CSS",
  summary: 'Checkbox demo "Tailwind CSS".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox-control].bg-success-soft" }],
});
