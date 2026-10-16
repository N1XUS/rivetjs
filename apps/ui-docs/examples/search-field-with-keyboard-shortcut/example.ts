import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: With Keyboard Shortcut",
  summary: 'SearchField demo "With Keyboard Shortcut".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "kbd" }],
});
