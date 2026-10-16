import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch DOM events and attributes",
  summary: "Global DOM events and attributes on a Switch land on its label; mousedown and the press handlers run before yours.",
  tags: ["switch", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["label:has(#dom-sw)", "lang", "nl"] },
    { attr: ["label:has(#dom-sw)", "data-setting", "notifications"] },
    { click: "label:has(#dom-sw)" },
    { expect: ["#dom-sw-log", "pointerenter"] },
    { expect: ["#dom-sw-log", "mousedown"] },
    { matches: "#dom-sw:checked" },
    { rightclick: "label:has(#dom-sw)" },
    { expect: ["#dom-sw-log", "contextmenu"] },
  ],
});
