import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tag: Content and States",
  summary:
    "Tags with icons and textValue, a render function that swaps its icon when selected, a disabled tag, size and variant from the group, and removable tags from list data.",
  tags: ["tag", "tag-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['#tag-diets [data-key="vegetarian"]', "aria-selected", "true"] },
    { attr: ['#tag-diets [data-key="halal"]', "aria-disabled", "true"] },
    { click: '#tag-diets [data-key="gluten-free"]' },
    { attr: ['#tag-diets [data-key="gluten-free"]', "aria-selected", "true"] },
    { click: '#tag-filters [data-key="one-pot"] [data-slot=tag-remove-button]' },
    { absent: '#tag-filters [data-key="one-pot"]' },
    { press: ['#tag-filters [data-key="budget"]', "Delete"] },
    { absent: '#tag-filters [data-key="budget"]' },
  ],
});
