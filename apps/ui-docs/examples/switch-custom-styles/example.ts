import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Tailwind CSS",
  summary: 'Switch demo "Tailwind CSS".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=switch-control]" }],
});
