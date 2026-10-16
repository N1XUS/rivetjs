import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Controlled",
  summary: 'RadioGroup demo "Controlled".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p", "pro"] }, { click: "[data-slot=radio-content]" }, { expect: ["p", "starter"] }],
});
