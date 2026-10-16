import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: DOM events and attributes",
  summary:
    "Global DOM events and attributes go to the viewport element; onScroll, onWheel and onPointerDown run after the viewport's own handler (which starts its engine).",
  tags: ["scrolling", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-vp", "lang", "en"] },
    { attr: ["#dom-vp", "aria-label", "Items"] },
    { click: '#dom-vp .row[data-index="1"]' },
    { expect: ["#dom-log", "pointerenter pointerdown click"] },
    { press: ["#dom-vp", "End"] },
    { expect: ["#dom-log", "scroll"] },
    { matches: '#dom-vp .row[data-index="499"]' },
  ],
});
