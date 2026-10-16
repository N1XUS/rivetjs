import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup DOM events and attributes",
  summary: "Global DOM events and attributes on the RadioGroup root and, on the item objects, on each radio's label.",
  tags: ["radio-group", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-rg", "lang", "pt"] },
    { attr: ["label:has(#dom-sim)", "lang", "pt-BR"] },
    { click: "#dom-sim" },
    { expect: ["#dom-rg-log", "group:pointerdown"] },
    { expect: ["#dom-rg-log", "sim:pointerenter"] },
  ],
});
