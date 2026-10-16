import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button DOM events and attributes",
  summary: "Global DOM events (pointer, mouse, context menu) and attributes (lang, dir) forwarded to the button element, chained after its own press handlers.",
  tags: ["button", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-btn", "lang", "fr"] },
    { attr: ["#dom-btn", "dir", "ltr"] },
    { click: "#dom-btn" },
    { expect: ["#dom-log", "pointerenter"] },
    // Button owns pointerdown: its press handler runs first, then yours.
    { expect: ["#dom-log", "pointerdown"] },
    { expect: ["#dom-log", "press"] },
  ],
});
