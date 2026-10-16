import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar keyboard navigation",
  summary:
    "Arrow keys move focus across a Toolbar's controls, through nested groups and separators, without wrapping; Tab leaves and returns to the last control.",
  tags: ["toolbar", "keyboard", "focus"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#format", "role", "toolbar"] },
    { attr: ["#format", "aria-orientation", "horizontal"] },
    { attr: ["#align-group", "role", "group"] },
    { press: ["#tb-before", "Tab"] },
    { focused: "#tb-bold" },
    { key: "ArrowRight" },
    { focused: "#tb-italic" },
    // Across the separator into the nested group.
    { key: "ArrowRight" },
    { focused: "#tb-left" },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { focused: "#tb-right" },
    // No wrap at the end.
    { key: "ArrowRight" },
    { focused: "#tb-right" },
    { key: "ArrowLeft" },
    { focused: "#tb-center" },
    // Tab leaves; Shift+Tab comes back to the last focused control.
    { key: "Tab" },
    { focused: "#tb-after" },
    { key: "Shift+Tab" },
    { focused: "#tb-center" },
  ],
});
