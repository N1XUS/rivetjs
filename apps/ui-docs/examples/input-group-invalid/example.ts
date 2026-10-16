import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Validation",
  summary: 'InputGroup demo "Validation".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }],
});
