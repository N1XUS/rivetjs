import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group DOM events and attributes",
  summary: "Global DOM events and attributes on a Group land on its <div>, merged with its own focus-within and hover handlers.",
  tags: ["group", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-group", "lang", "cs"] },
    { click: "#dom-group-input" },
    { expect: ["#dom-group-log", "pointerenter"] },
    { expect: ["#dom-group-log", "hover:true"] },
    { attr: ["#dom-group", "data-focus-within", "true"] },
  ],
});
