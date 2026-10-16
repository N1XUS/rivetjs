import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: sorting",
  summary:
    "allowsSorting columns and a two-way sortDescriptor signal: pressing a header sorts by it, again flips the direction (aria-sort, data-sort-direction).",
  tags: ["table", "sorting"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#pokemon-name", "aria-sort", "ascending"] },
    { attr: ["#pokemon-type", "aria-sort", "none"] },
    { attr: ["#pokemon-name", "data-allows-sorting", "true"] },
    { expect: ["#pokemon tbody tr:first-child", "Blastoise"] },
    { described: ["#pokemon-type", "sortable column"] },
    { click: "#pokemon-level" },
    { expect: ["#pokemon-sort", "Sorted by: level ascending"] },
    { attr: ["#pokemon-level", "aria-sort", "ascending"] },
    { attr: ["#pokemon-name", "aria-sort", "none"] },
    { expect: ["#pokemon tbody tr:first-child", "Blastoise"] },
    { click: "#pokemon-level" },
    { attr: ["#pokemon-level", "data-sort-direction", "descending"] },
    { expect: ["#pokemon tbody tr:first-child", "Pikachu"] },
    { press: ["#pokemon-level", "Enter"] },
    { expect: ["#pokemon-sort", "Sorted by: level ascending"] },
  ],
});
