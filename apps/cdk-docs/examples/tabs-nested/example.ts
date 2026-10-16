import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Nested tabs",
  summary: "Tabs inside a tab panel: each tablist keeps its own keyboard navigation and selection.",
  tags: ["aria", "tabs", "composition"],
  status: "experimental",
  frame: { height: 194, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#topic-ts-tab-install", "ArrowRight"] },
    { focused: "#topic-ts-tab-usage" },
    { attr: ["#topic-ts-tab-usage", "aria-selected", "true"] },
    { attr: ["#lang-tab-ts", "aria-selected", "true"] },
    { press: ["#lang-tab-ts", "ArrowRight"] },
    { focused: "#lang-tab-rs" },
    { matches: "#lang-tabpanel-rs" },
    { attr: ["#topic-rs-tab-install", "aria-selected", "true"] },
  ],
});
