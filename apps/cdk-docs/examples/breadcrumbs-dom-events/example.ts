import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs DOM events and attributes",
  summary: "Global DOM events and attributes on the Breadcrumbs <ol> and, set on each Breadcrumb, on its <li>.",
  tags: ["breadcrumbs", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-trail", "lang", "ko"] },
    { attr: ["#dom-trail li:first-child", "lang", "en"] },
    { click: "#dom-trail li:last-child" },
    { expect: ["#dom-bc-log", "list:pointerdown"] },
    { expect: ["#dom-bc-log", "here:pointerenter"] },
  ],
});
