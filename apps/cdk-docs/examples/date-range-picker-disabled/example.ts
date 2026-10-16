import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: disabled and read-only",
  summary: "isDisabled turns both fields and the calendar button off; isReadOnly keeps the segments focusable but fixes the value.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DateRangePicker:has(#off)", "data-disabled", "true"] },
    { attr: ["#off", "aria-disabled", "true"] },
    { attr: ["#off-start-day", "aria-disabled", "true"] },
    { attr: ["#off-start-day", "tabindex", null] },
    { attr: ["#off-button", "disabled", ""] },
    { attr: ["#off-start-input", "disabled", ""] },
    { attr: [".rv-DateRangePicker:has(#fixed)", "data-readonly", "true"] },
    { attr: ["#fixed-button", "disabled", ""] },
    { attr: ["#fixed-end-day", "aria-readonly", "true"] },
    { press: ["#fixed-end-day", "ArrowUp"] },
    { focused: "#fixed-end-day" },
    { expect: ["#fixed-end", "10/18/2026"] },
  ],
});
