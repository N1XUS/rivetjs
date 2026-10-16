import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "pressProps events",
  summary: "pressProps on a custom role=button element: every press event logged with its pointer type, isPressed() as data-pressed.",
  tags: ["cdk", "interactions", "press"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#target", "data-rv-pressable", ""] },
    { absent: "#target[data-pressed]" },
    { click: "#target" },
    { expect: ["#log", "pressstart:mouse pressup:mouse pressend:mouse press:mouse"] },
    { expect: ["#changes", "true false"] },
    { press: ["#target", "Enter"] },
    { expect: ["#log", "pressstart:keyboard pressup:keyboard pressend:keyboard press:keyboard"] },
    { press: ["#target", " "] },
    { expect: ["#count", "3 presses"] },
    { expect: ["#key", "last key:  "] },
  ],
});
