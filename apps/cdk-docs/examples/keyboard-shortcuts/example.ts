import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Keyboard shortcuts",
  summary: "keyboardProps shortcuts: Shift+Enter saves, Escape clears, an action returning false leaves the key alone.",
  tags: ["cdk", "interactions", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#note", "Buy milk"] },
    { key: "Shift+Enter" },
    { expect: ["#saved", "Saved: Buy milk"] },
    { key: "Escape" },
    { expect: ["#saved", "Saved: (cleared)"] },
    { key: "Alt+ArrowUp" },
    { expect: ["#log", "Alt+ArrowUp not handled"] },
  ],
});
