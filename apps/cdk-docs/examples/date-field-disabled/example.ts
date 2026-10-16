import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: disabled and read-only",
  summary: "isDisabled takes the segments out of the tab order and disables the form input; isReadOnly keeps focus but ignores edits.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#off", "aria-disabled", "true"] },
    { attr: ["#off-month", "aria-disabled", "true"] },
    { attr: ["#off-month", "tabindex", null] },
    { attr: ["#off-month", "contenteditable", null] },
    { attr: ["#off-input", "disabled", ""] },
    { attr: ["#ro-month", "aria-readonly", "true"] },
    { attr: ["#ro-month", "tabindex", "0"] },
    { attr: ["#ro-month", "data-readonly", "true"] },
    { press: ["#ro-month", "ArrowUp"] },
    { focused: "#ro-month" },
    { attr: ["#ro-month", "aria-valuenow", "10"] },
    { key: "5" },
    { attr: ["#ro-month", "aria-valuenow", "10"] },
    { attr: ["#ro-input", "disabled", null] },
  ],
});
