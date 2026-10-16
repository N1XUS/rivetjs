import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu onAction into a signal",
  summary: "onAction writes the activated key into your own signal; two menus can share one signal and your code can read and reset it.",
  tags: ["menu", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#c-value", "nothing yet"] },
    { click: "#c-file-trigger" },
    { click: '[data-key="save"]' },
    { expect: ["#c-value", "save"] },
    { attr: ["#c-reset", "disabled", null] },
    { click: "#c-view-trigger" },
    { click: '[data-key="zoom"]' },
    { expect: ["#c-value", "zoom"] },
    // Your code owns the signal: reset it.
    { click: "#c-reset" },
    { expect: ["#c-value", "nothing yet"] },
    { attr: ["#c-reset", "disabled", ""] },
  ],
});
