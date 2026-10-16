import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Focus an input",
  summary: "A ref gives a handler the real input element, so a button can focus it and read its value.",
  tags: ["refs", "events"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#query", "rivet"] },
    { expect: ["#length", "5 characters"] },
    { click: "#focus" },
    { press: ["#query", "Backspace"] },
    { expect: ["#length", "0 characters"] },
  ],
});
