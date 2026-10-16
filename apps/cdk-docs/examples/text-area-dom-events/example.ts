import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea DOM events and attributes",
  summary: "Global DOM events and attributes on the TextField root; text input events (onBeforeInput, onCut, onPaste, onSelect) on its TextArea part.",
  tags: ["text-area", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["div:has(> #dom-ta)", "dir", "ltr"] },
    { click: "#dom-ta" },
    { expect: ["#dom-ta-log", "root:pointerenter"] },
    { key: "x" },
    { expect: ["#dom-ta-log", "beforeinput:x"] },
    { key: "Shift+ArrowLeft" },
    { expect: ["#dom-ta-log", "select"] },
  ],
});
