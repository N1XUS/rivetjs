import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Default Value",
  summary: 'Calendar demo "Default Value".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 296, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=calendar-heading]", "February 2025"] }, { expect: ["td[aria-selected=true]", "14"] }],
});
