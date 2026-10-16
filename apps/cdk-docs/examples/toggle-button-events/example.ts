import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton events",
  summary: "onChange with the new state, the press events, and focus / key events of a ToggleButton, logged as they fire.",
  tags: ["toggle-button", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#mute" },
    { expect: ["#tb-log", "start:mouse"] },
    { expect: ["#tb-log", "pressed:true"] },
    { expect: ["#tb-log", "end:mouse"] },
    { expect: ["#tb-log", "change:true"] },
    { expect: ["#tb-log", "press:mouse"] },
    { expect: ["#tb-log", "focus:true"] },
    { press: ["#mute", "Enter"] },
    { expect: ["#tb-log", "keydown:Enter"] },
    { expect: ["#tb-log", "change:false"] },
    { expect: ["#tb-log", "press:keyboard"] },
    { key: "Tab" },
    { expect: ["#tb-log", "focus:false"] },
    { expect: ["#tb-log", "blur"] },
  ],
});
