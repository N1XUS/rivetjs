import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: In Surface",
  summary: 'RadioGroup demo "In Surface".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] [data-slot=radio-group]" }],
});
