import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs: Items",
  summary: "Rivet addition: `items` without a render function render one Breadcrumbs.Item per `{ label, href }` entry; the last one is the current page.",
  tags: ["breadcrumbs"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["li:last-child [data-slot=link]", "aria-current", "page"] }, { attr: ["a[href='#docs']", "href", "#docs"] }],
});
