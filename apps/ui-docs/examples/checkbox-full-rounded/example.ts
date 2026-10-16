import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Full Rounded",
  summary: 'Checkbox demo "Full Rounded".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox-control].rounded-full" }],
});
