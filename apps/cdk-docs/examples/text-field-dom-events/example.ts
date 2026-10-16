import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField DOM events and attributes",
  summary:
    "Global DOM events and attributes land on the TextField root; text input events (onBeforeInput, onPaste, onCopy, onSelect, composition) on the Input part.",
  tags: ["text-field", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["div:has(> #dom-tf)", "lang", "sv"] },
    { attr: ["#dom-tf", "title", "Ditt namn"] },
    { click: "#dom-tf" },
    { expect: ["#dom-tf-log", "root:pointerenter"] },
    { key: "a" },
    { expect: ["#dom-tf-log", "beforeinput:a"] },
    { key: "Shift+ArrowLeft" },
    { expect: ["#dom-tf-log", "select"] },
  ],
});
