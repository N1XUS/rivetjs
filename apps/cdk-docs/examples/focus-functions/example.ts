import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Focus functions",
  summary: "focusFirst, focusLast, saveFocus, containFocus and inertOutside from @rivetjs/cdk/focus, wired to buttons and keys.",
  tags: ["cdk", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#first" },
    { focused: "#a" },
    { click: "#last" },
    { focused: "#c" },
    // containFocus on the box's keydown: Tab wraps from the last element.
    { press: ["#c", "Tab"] },
    { focused: "#a" },
    { key: "Shift+Tab" },
    { focused: "#c" },
    // saveFocus: remember, move focus away, restore.
    { press: ["#remember", "Enter"] },
    { focused: "#a" },
    { press: ["#a", "Escape"] },
    { focused: "#remember" },
    // inertOutside: everything else inert while isolated.
    { click: "#isolate" },
    { matches: "#outside[inert]" },
    { click: "#release" },
    { absent: "#outside[inert]" },
  ],
});
