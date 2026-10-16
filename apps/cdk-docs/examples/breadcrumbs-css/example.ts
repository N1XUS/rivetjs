import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs with plain CSS",
  summary: "A plain stylesheet for .rv-Breadcrumbs, .rv-Breadcrumb and the Link inside, using [data-current] for the last item.",
  tags: ["breadcrumbs", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [{ matches: "ol.rv-Breadcrumbs > li.rv-Breadcrumb > a.rv-Link" }, { matches: "li.rv-Breadcrumb[data-current] > span.rv-Link[aria-current='page']" }],
});
