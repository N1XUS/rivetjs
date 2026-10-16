import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu events",
  summary: "Menu onAction runs once per activation (click, Enter or Space) with the item key, before the menu closes; disabled items never call it.",
  tags: ["menu", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#e-trigger" },
    { click: '[data-key="cut"]' },
    { expect: ["#e-log", "cut"] },
    { press: ["#e-trigger", "Enter"] },
    { focused: '[data-key="cut"]' },
    { key: "ArrowDown" },
    { key: "Space" },
    { expect: ["#e-log", "cut, copy"] },
    { expect: ["#e-count", "2"] },
    // Wait for the exit transition: reopening a still-mounted menu keeps its focus (no new autoFocus, as upstream).
    { absent: "#e" },
    { press: ["#e-trigger", "ArrowUp"] },
    // The last item is a link; ArrowUp skips the disabled one before it.
    { focused: '[data-key="docs"]' },
    { key: "ArrowUp" },
    { focused: '[data-key="copy"]' },
    { key: "Escape" },
    { expect: ["#e-count", "2"] },
  ],
});
