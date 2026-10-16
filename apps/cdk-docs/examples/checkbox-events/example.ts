import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox events",
  summary: "onChange with the new state, press, focus and key events of a CheckboxField (on its input) and hover events of its CheckboxButton.",
  tags: ["checkbox", "events"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "label:has(#cb-ev)" },
    { expect: ["#cb-log", "hover"] },
    { expect: ["#cb-log", "press:mouse"] },
    { expect: ["#cb-log", "change:true"] },
    { expect: ["#cb-log", "focus:true"] },
    { focused: "#cb-ev" },
    { key: "Space" },
    { expect: ["#cb-log", "keydown: "] },
    { expect: ["#cb-log", "change:false"] },
    { expect: ["#cb-log", "press:keyboard"] },
    { expect: ["#cb-log", "keyup: "] },
    { key: "Tab" },
    { expect: ["#cb-log", "blur focus:false"] },
  ],
});
