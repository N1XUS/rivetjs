import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Validation",
  summary: 'SearchField demo "Validation".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }],
});
