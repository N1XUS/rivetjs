import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Custom Icons",
  summary: 'SearchField demo "Custom Icons".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=search-field-search-icon] svg" }],
});
