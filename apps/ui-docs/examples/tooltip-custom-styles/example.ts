import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: Tailwind CSS",
  summary: 'Tooltip demo "Tailwind CSS".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "[data-slot=button]" }, { expect: ["[role=tooltip]", "Copied to clipboard"] }],
});
