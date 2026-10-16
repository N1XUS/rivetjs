import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs with plain CSS",
  summary:
    "No utilities: styles.css targets the .rv-Tabs, .rv-TabList, .rv-Tab and .rv-TabPanel class names and [data-selected], [data-disabled], [data-focus-visible], [data-orientation].",
  tags: ["aria", "tabs", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#plain.rv-Tabs > .rv-TabList > .rv-Tab" },
    { matches: "#plain > .rv-TabPanel" },
    { press: ["#plain-tab-css", "ArrowRight"] },
    { focused: "#plain-tab-js" },
    { attr: ["#plain-tab-js", "aria-selected", "true"] },
    { attr: ["#plain-tab-js", "data-focus-visible", "true"] },
  ],
});
