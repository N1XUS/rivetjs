import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar DOM events and attributes",
  summary: "Global DOM events and attributes on a Toolbar land on its <div>; its own keydown and focus handlers run unchanged.",
  tags: ["toolbar", "events", "dom"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-tools", "lang", "uk"] },
    { click: "#dom-t1" },
    { expect: ["#dom-tools-log", "pointerenter"] },
    { expect: ["#dom-tools-log", "pointerdown"] },
    { key: "ArrowRight" },
    { focused: "#dom-t2" },
  ],
});
