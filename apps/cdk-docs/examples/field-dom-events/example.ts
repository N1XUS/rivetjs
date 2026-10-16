import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Label, Text and FieldError DOM events",
  summary: "Global DOM events and attributes on the field parts: each lands on the part's own element (label, span / div / p, error span).",
  tags: ["label", "text", "field-error", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-label", "lang", "fi"] },
    { attr: ["#dom-text", "lang", "fi"] },
    { click: "#dom-label" },
    { expect: ["#dom-parts-log", "label:click"] },
    { click: "#dom-text" },
    { expect: ["#dom-parts-log", "text:pointerdown"] },
    { click: "#dom-error" },
    { expect: ["#dom-parts-log", "error:pointerenter"] },
  ],
});
