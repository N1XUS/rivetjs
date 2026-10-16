import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip options",
  summary: 'isDisabled never opens; trigger="focus" opens on keyboard focus only, not on hover; a custom trigger element through <Focusable> with a role.',
  tags: ["tooltip", "disabled", "focus"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // isDisabled: keyboard focus, no tooltip.
    { key: "Tab" },
    { focused: "#to-disabled-button" },
    { absent: "#to-disabled" },
    // trigger="focus": keyboard focus opens it.
    { key: "Tab" },
    { focused: "#to-focus-button" },
    { matches: "#to-focus" },
    // Focusable: the span gets tabindex 0 and the trigger handlers.
    { key: "Tab" },
    { absent: "#to-focus" },
    { focused: "#to-span-trigger" },
    { attr: ["#to-span-trigger", "tabindex", "0"] },
    { matches: "#to-span" },
    { described: ["#to-span-trigger", "Any focusable element"] },
  ],
});
