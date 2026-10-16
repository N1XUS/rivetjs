import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: With Validation",
  summary: 'SearchField demo "With Validation".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input", "ab"] }, { matches: "[data-slot=field-error]" }],
});
