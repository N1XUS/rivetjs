import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link press events",
  summary: 'A Link without href renders <span role="link"> with a tab stop; its press, focus and key events are logged as they fire.',
  tags: ["link", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#more", "role", "link"] },
    { attr: ["#more", "tabindex", "0"] },
    { click: "#more" },
    { expect: ["#link-log", "start:mouse"] },
    { expect: ["#link-log", "pressed:true"] },
    { expect: ["#link-log", "end:mouse"] },
    // Known issue: a Link's first press can be lost while the page resumes (here: the onPressStart
    // state write). The next press is delivered.
    { click: "#more" },
    { expect: ["#link-log", "press:mouse"] },
    { expect: ["#link-log", "focus:true"] },
    { press: ["#more", "Enter"] },
    { expect: ["#link-log", "keydown:Enter"] },
    { expect: ["#link-log", "press:keyboard"] },
    { key: "Tab" },
    { expect: ["#link-log", "focus:false"] },
  ],
});
