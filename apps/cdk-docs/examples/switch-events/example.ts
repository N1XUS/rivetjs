import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch events",
  summary: "onChange with the new state, press and hover events of the label, and focus and key events of the input of a Switch, logged as they fire.",
  tags: ["switch", "events"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Pointer: a press on the label toggles it (press:mouse, change) and focuses the input.
    { click: "label:has(#sw-ev)" },
    { expect: ["#sw-log", "hover"] },
    { expect: ["#sw-log", "press:mouse"] },
    { expect: ["#sw-log", "change:true"] },
    { focused: "#sw-ev" },
    { expect: ["#sw-log", "focus focus:true"] },
    // Keyboard: Space on the focused input toggles it back (native change), press:keyboard from the input's press handler.
    { key: "Space" },
    { expect: ["#sw-log", "keydown: "] },
    { expect: ["#sw-log", "change:false"] },
    { expect: ["#sw-log", "press:keyboard"] },
    { expect: ["#sw-log", "keyup: "] },
    { key: "Tab" },
    { expect: ["#sw-log", "blur focus:false"] },
  ],
});
