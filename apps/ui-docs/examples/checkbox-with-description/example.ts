import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: With Description",
  summary: 'Checkbox demo "With Description".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox] [data-slot=description]" }],
});
