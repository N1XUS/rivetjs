import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip interactions",
  summary:
    "delay (default 1500 ms) before a hover opens, closeDelay (default 500 ms) after the pointer leaves, shouldCloseOnPress; keyboard focus opens at once; one tooltip at a time.",
  tags: ["tooltip", "hover", "delay"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // Keyboard focus ignores delay.
    { key: "Tab" },
    { focused: "#td-edit-button" },
    { matches: "#td-edit" },
    // A press (Enter) closes it by default.
    { key: "Enter" },
    { absent: "#td-edit" },
    // shouldCloseOnPress={false}: the press keeps it open.
    { key: "Tab" },
    { matches: "#td-save" },
    { absent: "#td-edit" },
    { key: "Enter" },
    { matches: "#td-save" },
    { key: "Escape" },
    { absent: "#td-save" },
  ],
});
