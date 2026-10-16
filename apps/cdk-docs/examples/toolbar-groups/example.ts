import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar with groups",
  summary: "The Toolbar component: arrow keys cross a nested toolbar, a separator and a Group without wrapping; Tab leaves and returns to the last control.",
  tags: ["toolbar", "keyboard", "css"],
  status: "experimental",
  frame: { height: 203, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tools", "role", "toolbar"] },
    { attr: ["#tools", "aria-orientation", "horizontal"] },
    { attr: ["#tools", "data-rk", "ArrowLeft ArrowRight"] },
    { attr: ["#align", "role", "group"] },
    { attr: ["#tools", "lang", "en"] },
    { press: ["#before", "Tab"] },
    { focused: "#align-left" },
    { key: "ArrowRight" },
    { focused: "#align-center" },
    // Horizontal: Up / Down are left alone.
    { key: "ArrowDown" },
    { focused: "#align-center" },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    // Across the separator into the Group.
    { focused: "#zoom-in" },
    { key: "ArrowRight" },
    { focused: "#zoom-out" },
    // No wrap.
    { key: "ArrowRight" },
    { focused: "#zoom-out" },
    { key: "ArrowLeft" },
    { focused: "#zoom-in" },
    // Tab leaves the toolbar; Shift+Tab comes back to the last focused control.
    { key: "Tab" },
    { focused: "#after" },
    { key: "Shift+Tab" },
    { focused: "#zoom-in" },
    // Root DOM events are forwarded (the click bubbles up from a button).
    { click: "#align-right" },
    { expect: ["#tb-log", "toolbar-click"] },
  ],
});
