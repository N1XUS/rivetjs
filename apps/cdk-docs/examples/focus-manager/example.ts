import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "useFocusManager",
  summary: "Arrow keys, Home and End move focus inside a FocusScope through useFocusManager(): next / previous with wrap, first, last, tabbable only.",
  tags: ["cdk", "focus", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#bold", "ArrowRight"] },
    { focused: "#italic" },
    { key: "ArrowRight" },
    { focused: "#underline" },
    { key: "ArrowRight" },
    { focused: "#bold" },
    { key: "ArrowLeft" },
    { focused: "#underline" },
    { key: "Home" },
    { focused: "#bold" },
    { key: "End" },
    { focused: "#underline" },
  ],
});
