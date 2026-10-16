import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link DOM events and attributes",
  summary: "Global DOM events and attributes on a Link land on its <a> or <span>, merged with its press handlers; onClick is a press option.",
  tags: ["link", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-link", "lang", "ja"] },
    { click: "#dom-link" },
    { expect: ["#dom-link-log", "pointerenter"] },
    { expect: ["#dom-link-log", "pointerdown"] },
    // Known issue: the first press can be lost when another handler (here onPointerEnter) resumed
    // the page during the same click. The next press is delivered.
    { click: "#dom-link" },
    { expect: ["#dom-link-log", "press"] },
  ],
});
