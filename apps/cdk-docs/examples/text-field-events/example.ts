import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField events",
  summary: "onChange with the new text, onInput chained after the field's own handler, and the focus and key events of a TextField.",
  tags: ["text-field", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#tf-ev", "hi"] },
    { expect: ["#tf-log", "focus focus:true"] },
    { expect: ["#tf-log", "change:hi"] },
    { expect: ["#tf-log", "input:hi"] },
    { press: ["#tf-ev", "!"] },
    { expect: ["#tf-log", "keydown:!"] },
    { expect: ["#tf-log", "change:hi!"] },
    { expect: ["#tf-log", "keyup:!"] },
    { key: "Tab" },
    { expect: ["#tf-log", "blur focus:false"] },
  ],
});
