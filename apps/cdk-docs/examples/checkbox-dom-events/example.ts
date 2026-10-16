import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox DOM events and attributes",
  summary: "Global DOM events and attributes on CheckboxField land on its div, on CheckboxButton on the label (after its own press handlers).",
  tags: ["checkbox", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-CheckboxField:has(#dom-cb)", "lang", "es"] },
    { attr: [".rv-CheckboxField:has(#dom-cb)", "data-track", "remember"] },
    { click: "label:has(#dom-cb)" },
    { expect: ["#dom-cb-log", "pointerenter"] },
    { expect: ["#dom-cb-log", "field:pointerenter"] },
    { expect: ["#dom-cb-log", "mousedown"] },
    { matches: "#dom-cb:checked" },
    { rightclick: "label:has(#dom-cb)" },
    { expect: ["#dom-cb-log", "contextmenu"] },
  ],
});
