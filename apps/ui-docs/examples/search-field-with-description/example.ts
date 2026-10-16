import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: With Description",
  summary: 'SearchField demo "With Description".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=description]" }],
});
