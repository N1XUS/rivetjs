import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Shorthand",
  summary:
    "Rivet addition: `label`, `description` and `placeholder` props instead of the Label, Group (search icon, input, clear button) and Description parts.",
  tags: ["search-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["input[type=search]", "Search"] },
    { described: ["input[type=search]", "Titles and authors"] },
    { fill: ["input[type=search]", "hero"] },
    { click: "[data-slot=search-field-clear-button]" },
    { attr: ["[data-slot=search-field]", "data-empty", "true"] },
  ],
});
