import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Label Position",
  summary: 'Switch demo "Label Position".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=switch]" }],
});
