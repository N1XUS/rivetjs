import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs DOM events and attributes",
  summary: "Global DOM events and attributes on Tabs, TabList, Tab and TabPanel: each lands on its own element; a tab's press runs before your handlers.",
  tags: ["aria", "tabs", "events"],
  status: "experimental",
  frame: { height: 203, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom", "lang", "en"] },
    { attr: ["#dom [role=tablist]", "dir", "ltr"] },
    { attr: ["#dom-tab-two", "lang", "it"] },
    { attr: ["#dom-tab-one", "lang", null] },
    { click: "#dom-tab-two" },
    { expect: ["#value", "Selected: two"] },
    { expect: ["#log", "root:pointerenter, tab-two:pointerup"] },
    { attr: ["#dom-tabpanel-two", "lang", "es"] },
    { click: "#body-two" },
    { expect: ["#log", "tab-two:pointerup, panel-two:click"] },
    { dblclick: "#dom-tab-two" },
    { expect: ["#log", "list:dblclick"] },
  ],
});
