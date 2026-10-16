import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs",
  summary: 'Breadcrumbs render an <ol> of links named "Breadcrumbs"; the last item is the current page (aria-current="page", not a link).',
  tags: ["breadcrumbs", "navigation"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#trail", "aria-label", "Breadcrumbs"] },
    { attr: ["#trail li:first-child a", "href", "#home"] },
    { attr: ["#trail li:last-child", "data-current", "true"] },
    { attr: ["#trail li:last-child .rv-Link", "aria-current", "page"] },
    { attr: ["#trail li:last-child .rv-Link", "aria-disabled", "true"] },
    { matches: "#trail li:last-child span.rv-Link" },
  ],
});
