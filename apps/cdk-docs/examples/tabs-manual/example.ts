import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Manual activation",
  summary: 'keyboardActivation="manual": arrow keys only move focus (and the tab stop); Enter or Space selects the focused tab.',
  tags: ["aria", "tabs", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#reports-tab-daily", "ArrowRight"] },
    { focused: "#reports-tab-weekly" },
    { attr: ["#reports-tab-weekly", "aria-selected", "false"] },
    { attr: ["#reports-tab-weekly", "tabindex", "0"] },
    { attr: ["#reports-tab-daily", "tabindex", "-1"] },
    { expect: ["#value", "Selected: daily"] },
    { key: "Enter" },
    { attr: ["#reports-tab-weekly", "aria-selected", "true"] },
    { expect: ["#value", "Selected: weekly"] },
    { expect: ["#reports-tabpanel-weekly", "Weekly report"] },
    { key: "ArrowRight" },
    { focused: "#reports-tab-monthly" },
    { key: " " },
    { expect: ["#value", "Selected: monthly"] },
  ],
});
