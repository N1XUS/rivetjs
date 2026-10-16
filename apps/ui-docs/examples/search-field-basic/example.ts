import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Usage",
  summary: 'SearchField demo "Usage".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["input[type=search]", "Search"] },
    { fill: ["input[type=search]", "hero"] },
    { click: "[data-slot=search-field-clear-button]" },
    { attr: ["[data-slot=search-field]", "data-empty", "true"] },
  ],
});
