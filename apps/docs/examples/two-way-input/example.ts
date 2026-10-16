import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Two-way input",
  summary: "model:value and model:checked keep a text field and a checkbox in sync with signals.",
  tags: ["forms", "signals"],
  frame: { height: 200, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#greeting", "Hello, friend"] },
    { fill: ["#name", "Ada"] },
    { expect: ["#greeting", "Hello, Ada"] },
    { click: "#loud" },
    { expect: ["#greeting", "HELLO, ADA"] },
    { click: "#reset" },
    { expect: ["#greeting", "Hello, friend"] },
  ],
});
