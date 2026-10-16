import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu long press trigger",
  summary:
    'trigger="longPress": a press runs the Button\'s own onPress, a long press (500 ms) or Alt+ArrowDown opens the menu; the trigger describes the gesture.',
  tags: ["menu", "trigger"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { described: ["#lp-trigger", "Long press or press Alt + ArrowDown to open menu"] },
    // A short press is the button's primary action, not the menu.
    { click: "#lp-trigger" },
    { expect: ["#lp-count", "1"] },
    { absent: "#lp" },
    // Plain ArrowDown does not open a long-press menu; Alt+ArrowDown does.
    { press: ["#lp-trigger", "ArrowDown"] },
    { absent: "#lp" },
    { press: ["#lp-trigger", "Alt+ArrowDown"] },
    { focused: '[data-key="rotate"]' },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#lp-tool", "slice"] },
    { absent: "#lp" },
    { focused: "#lp-trigger" },
    { expect: ["#lp-count", "1"] },
  ],
});
