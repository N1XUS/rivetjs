import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Uncontrolled",
  summary: 'RadioGroup demo "Uncontrolled".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=radio-content]" }, { expect: ["p", "starter"] }],
});
