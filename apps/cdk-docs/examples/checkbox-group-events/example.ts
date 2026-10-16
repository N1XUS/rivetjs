import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup events",
  summary: "onChange and onFocusChange of a CheckboxGroup (focus within) next to the change, focus and key events of its checkboxes, logged as they fire.",
  tags: ["checkbox-group", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "label:has(input[value='email'])" },
    { expect: ["#cg-log", "email:true"] },
    { expect: ["#cg-log", "group:[email]"] },
    { expect: ["#cg-log", "email:focus:true"] },
    { expect: ["#cg-log", "group:focus:true"] },
    { key: "Tab" },
    { focused: "input[value='sms']" },
    { expect: ["#cg-log", "email:focus:false"] },
    { key: "Space" },
    { expect: ["#cg-log", "sms:keydown: "] },
    { expect: ["#cg-log", "group:[email,sms]"] },
    { key: "Tab" },
    { expect: ["#cg-log", "group:focus:false"] },
  ],
});
