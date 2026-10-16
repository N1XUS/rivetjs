import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListKeyManager",
  summary:
    "A ListKeyManager over plain data items: horizontal arrows (mirrored in right-to-left), no vertical keys, Shift allowed, setLastItemActive from a button.",
  tags: ["keyboard", "key-manager"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#lk-xs", "ArrowRight"] },
    { focused: "#lk-s" },
    { attr: ["#lk-s", "tabindex", "0"] },
    // M is disabled: skipped (the default skip predicate).
    { key: "ArrowRight" },
    { focused: "#lk-l" },
    // withAllowedModifierKeys(["shiftKey"]): Shift+arrow still moves.
    { key: "Shift+ArrowRight" },
    { focused: "#lk-xl" },
    // Alt is not allowed, and withVerticalOrientation(false) ignores Up / Down.
    { key: "Alt+ArrowLeft" },
    { focused: "#lk-xl" },
    { key: "ArrowUp" },
    { focused: "#lk-xl" },
    { key: "ArrowLeft" },
    { focused: "#lk-l" },
    { expect: ["#lk-value", "L"] },
    // Programmatic: setLastItemActive().
    { click: "#lk-last" },
    { focused: "#lk-xl" },
    // Right-to-left: ArrowLeft moves forward.
    { press: ["#rtl-xs", "ArrowLeft"] },
    { focused: "#rtl-s" },
  ],
});
