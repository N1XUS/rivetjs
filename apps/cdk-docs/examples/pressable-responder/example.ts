import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Pressable, PressResponder and Focusable",
  summary:
    "Pressable gives any element press events and focusability; PressResponder passes press handlers to the pressable inside; Focusable with FocusableProvider adds DOM props.",
  tags: ["pressable", "press-responder", "focusable", "interactions"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#pr-card", "tabindex", "0"] },
    { click: "#pr-card" },
    { expect: ["#pr-log", "responder press, own press"] },
    { press: ["#pr-card", "Enter"] },
    { expect: ["#pr-count", "2"] },
    { described: ["#pr-focus", "Opens the help panel"] },
  ],
});
