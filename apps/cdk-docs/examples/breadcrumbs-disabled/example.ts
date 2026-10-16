import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled Breadcrumbs",
  summary: 'isDisabled on Breadcrumbs disables every breadcrumb: each renders <span role="link" aria-disabled="true"> with data-disabled on its <li>.',
  tags: ["breadcrumbs", "disabled"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#off-trail li:first-child", "data-disabled", "true"] },
    { attr: ["#off-trail li:first-child .rv-Link", "aria-disabled", "true"] },
    { matches: "#off-trail li:first-child span.rv-Link" },
  ],
});
