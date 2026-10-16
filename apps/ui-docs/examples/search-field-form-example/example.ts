import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Form Example",
  summary: 'SearchField demo "Form Example".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input", "ab"] }, { matches: "[data-slot=field-error]" }, { fill: ["input", "abc"] }, { absent: "[data-slot=field-error]" }],
});
