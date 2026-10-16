import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Tailwind CSS",
  summary: 'SearchField demo "Tailwind CSS".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=search-field]" }],
});
