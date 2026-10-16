import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Group",
  summary: 'Switch demo "Group".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=switch-group] [data-slot=switch]" }],
});
