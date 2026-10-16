import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled ToggleButton",
  summary: "A disabled ToggleButton never changes and is skipped by Tab; excludeFromTabOrder keeps an enabled one out of the Tab order.",
  tags: ["toggle-button", "disabled"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#locked", "disabled", ""] },
    { attr: ["#locked", "data-disabled", "true"] },
    { attr: ["#locked", "aria-pressed", "true"] },
    { attr: ["#mouse-only", "tabindex", "-1"] },
    { press: ["#grid", "Tab"] },
    { focused: "#after" },
    { click: "#mouse-only" },
    { attr: ["#mouse-only", "aria-pressed", "true"] },
  ],
});
