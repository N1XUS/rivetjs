import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: Render Function",
  summary: 'TimeField demo "Render Function".',
  tags: ["time-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-custom=foo]", "data-slot", "time-field"] }],
});
