import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link tabs",
  summary: 'Items with href render as <a role="tab">: a click or Enter opens the link through the router in scope, and the URL drives selectedKey.',
  tags: ["aria", "tabs", "links"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "a#pages-tab-details[role=tab][href='/details']" },
    { attr: ["#pages-tab-docs", "target", "_blank"] },
    { attr: ["#pages-tab-docs", "rel", "noreferrer"] },
    { click: "#pages-tab-details" },
    { expect: ["#url", "URL: /details"] },
    { attr: ["#pages-tab-details", "aria-selected", "true"] },
    { expect: ["#pages-tabpanel-details", "Details page."] },
    { press: ["#pages-tab-details", "ArrowLeft"] },
    { focused: "#pages-tab-summary" },
    { key: "Enter" },
    { expect: ["#url", "URL: /summary"] },
    { attr: ["#pages-tab-summary", "aria-selected", "true"] },
  ],
});
