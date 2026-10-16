import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Keyboard shortcuts",
  summary:
    "createKeyboardShortcutHandler maps shortcut strings (Mod+s, Control+Shift+z, Alt+ArrowDown, Escape) to actions; returning false lets the key through.",
  tags: ["cdk", "keys", "keyboard", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#draft", "ControlOrMeta+s"] },
    { expect: ["#log li:nth-child(1)", "save"] },
    { key: "Control+Shift+Z" },
    { expect: ["#log li:nth-child(2)", "redo"] },
    { key: "Alt+ArrowDown" },
    { expect: ["#log li:nth-child(3)", "move line down"] },
    { key: "Escape" },
    { expect: ["#log li:nth-child(4)", "cancel"] },
    { key: "Enter" },
    { expect: ["#log li:nth-child(5)", "empty: Enter blocked"] },
    { fill: ["#draft", "hello"] },
    { press: ["#draft", "Enter"] },
    { press: ["#draft", "Escape"] },
    { expect: ["#log li:nth-child(5)", "cancel"] },
  ],
});
