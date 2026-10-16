import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Pagination: Shorthand",
  summary: "Rivet addition: `total` + `page` render Previous, the page links with ellipses and Next; the page is a two-way Signal.",
  tags: ["pagination"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=pagination-link][aria-current=page]", "data-active", "true"] },
    { click: "[data-slot=pagination-next]" },
    { expect: ["[data-slot=pagination-link][aria-current=page]", "2"] },
    { expect: ["#pagination-shorthand-page", "Page 2 of 12"] },
  ],
});
