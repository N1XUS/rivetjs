import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup: Shorthand",
  summary:
    "Rivet addition: `label`, `description`, `errorMessage` and `items` render the Label, the tag list, the Description and the ErrorMessage around the tags.",
  tags: ["tag-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["[role=grid]", "Amenities"] }, { click: "[role=row][data-key=pool]" }, { attr: ["[role=row][data-key=pool]", "aria-selected", "true"] }],
});
