import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: DOM events and attributes",
  summary:
    "Global DOM events and attributes (onPointerEnter, onClick, onWheel, onScroll, lang, translate) go to the scroller element; onScroll runs after the virtualizer's own handler.",
  tags: ["virtualizer", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#events-list", "lang", "en"] },
    { attr: ["#events-list", "translate", "no"] },
    { click: '#events-list [data-rv-view="2"]' },
    { expect: ["#events-log", "pointerenter pointerdown click"] },
    { press: ["#events-list", "PageDown"] },
    { expect: ["#events-log", "scroll"] },
    { matches: '#events-list [data-rv-view="12"]' },
  ],
});
