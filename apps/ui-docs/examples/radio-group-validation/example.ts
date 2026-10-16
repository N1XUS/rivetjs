import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Validation",
  summary: 'RadioGroup demo "Validation".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[type=submit]" }, { matches: "[data-slot=field-error]" }],
});
