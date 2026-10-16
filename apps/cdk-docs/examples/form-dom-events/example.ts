import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form DOM events and attributes",
  summary: "Global DOM events and attributes on a Form land on the <form> element; events from fields inside bubble to it as usual.",
  tags: ["form", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-form", "lang", "pl"] },
    { attr: ["#dom-form", "dir", "ltr"] },
    { click: "#dom-form-input" },
    { expect: ["#dom-form-log", "pointerenter"] },
    { expect: ["#dom-form-log", "pointerdown"] },
  ],
});
