import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusMonitor",
  summary: "FocusMonitor reports how an element got focus (keyboard, mouse, program) and sets cdk-*-focused classes; checkChildren covers a whole group.",
  tags: ["cdk", "a11y", "angular-cdk", "focus"],
  status: "experimental",
  frame: { height: 186, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#field" },
    { expect: ["#origin", "mouse"] },
    { matches: "#field.cdk-focused.cdk-mouse-focused" },
    { press: ["#program", "Tab"] },
    { expect: ["#origin", "keyboard"] },
    { matches: "#field.cdk-keyboard-focused" },
    { click: "#program" },
    { expect: ["#origin", "program"] },
    { matches: "#field.cdk-program-focused" },
    { press: ["#field", "Tab"] },
    { expect: ["#origin", "blurred"] },
    { absent: "#field.cdk-focused" },
    { matches: "#group.cdk-keyboard-focused" },
  ],
});
