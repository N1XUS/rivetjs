import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: disabled and read-only",
  summary: "isDisabled disables the segments, the button and the form input; isReadOnly keeps the segments focusable but fixed.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#off", "aria-disabled", "true"] },
    { attr: [".rv-DatePicker[data-disabled]", "data-disabled", "true"] },
    { attr: ["#off-button", "disabled", ""] },
    { attr: ["#off-field-day", "tabindex", null] },
    { attr: ["#off-field-input", "disabled", ""] },
    { attr: ["#ro-button", "disabled", ""] },
    { attr: [".rv-DatePicker[data-readonly]", "data-readonly", "true"] },
    { press: ["#ro-field-day", "ArrowUp"] },
    { focused: "#ro-field-day" },
    { attr: ["#ro-field-day", "aria-valuenow", "14"] },
  ],
});
