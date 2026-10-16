import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField with stepper buttons",
  summary:
    "A NumberField bound to a signal: Label, a Group with decrement / increment Buttons (lucide icons) around the Input, and a description; arrows, typing + Enter and the steppers change the value.",
  tags: ["number-field", "tailwind", "signals", "icons"],
  status: "experimental",
  frame: { height: 144, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#width", "value", "1,024"] },
    { attr: ["#width", "aria-roledescription", "Number field"] },
    { name: ["#width", "Width"] },
    { press: ["#width", "ArrowUp"] },
    { expect: ["#width-value", "1025"] },
    { click: "#width-field [slot=decrement]" },
    { click: "#width-field [slot=decrement]" },
    { expect: ["#width-value", "1023"] },
    { fill: ["#width", "2048"] },
    { press: ["#width", "Enter"] },
    { attr: ["#width", "value", "2,048"] },
  ],
});
