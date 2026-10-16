import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Focused Value",
  summary: 'Calendar demo "Focused Value".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 376, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ click: "text=Go to Jan" }, { expect: ["[data-slot=calendar-heading]", "January 2025"] }],
});
