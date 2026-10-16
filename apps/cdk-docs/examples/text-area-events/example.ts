import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea events",
  summary: "onChange with the new text, onInput chained after the field's own handler, and the focus and key events of a TextField with a TextArea part.",
  tags: ["text-area", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#ta-ev", "hey"] },
    { expect: ["#ta-log", "focus:true"] },
    { expect: ["#ta-log", "change:hey"] },
    { expect: ["#ta-log", "input"] },
    { press: ["#ta-ev", "Enter"] },
    { expect: ["#ta-log", "keydown:Enter"] },
    { expect: ["#ta-log", "change:hey\\n"] },
    { expect: ["#ta-log", "keyup:Enter"] },
    { key: "Tab" },
    { expect: ["#ta-log", "blur focus:false"] },
  ],
});
