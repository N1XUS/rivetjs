import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs onAction",
  summary: "onAction receives the key of a pressed breadcrumb: client-side folder navigation without hrefs, the trail shrinking as you go up.",
  tags: ["breadcrumbs", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#folders li:first-child .rv-Link", "role", "link"] },
    { click: "#folders li:nth-child(2) .rv-Link" },
    { expect: ["#bc-log", "action:photos"] },
    { absent: "#folders li:nth-child(3)" },
    { attr: ["#folders li:nth-child(2)", "data-current", "true"] },
  ],
});
