import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: plain CSS",
  summary: "Plain CSS on the default rv-TimeField / rv-DateInput / rv-DateSegment classes and their data attributes (placeholder, invalid, disabled).",
  tags: ["aria", "date", "time", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css", "class", "rv-DateInput"] },
    { attr: ["#css-hour", "class", "rv-DateSegment"] },
    { attr: ["#css-hour", "data-placeholder", "true"] },
    { attr: ["#css-bad-hour", "aria-invalid", "true"] },
    { expect: ["#css-bad-error", "10:00 PM or earlier."] },
    { attr: [".rv-TimeField:has(#css-off)", "data-disabled", "true"] },
    { press: ["#css-hour", "ArrowUp"] },
    { attr: ["#css-hour", "data-placeholder", null] },
    { attr: ["#css-hour", "aria-valuenow", "8"] },
  ],
});
