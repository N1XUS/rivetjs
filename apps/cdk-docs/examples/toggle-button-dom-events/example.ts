import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton DOM events and attributes",
  summary: "Global DOM events and attributes on a ToggleButton: pointer events, an owned onClick chained after the toggle, lang.",
  tags: ["toggle-button", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-tb", "lang", "de"] },
    { click: "#dom-tb" },
    { expect: ["#dom-tb-log", "pointerenter"] },
    { expect: ["#dom-tb-log", "pointerdown"] },
    // onClick is owned: the toggle already ran when your handler sees it.
    { expect: ["#dom-tb-log", "click:true"] },
  ],
});
