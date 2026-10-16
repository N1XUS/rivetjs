import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: plain CSS",
  summary: "A stylesheet on .rv-DateField, .rv-DateInput, .rv-DateSegment and their data attributes, without Tailwind or theme.css.",
  tags: ["aria", "date", "styling", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css", "class", "rv-DateInput"] },
    { attr: ["#css-month", "class", "rv-DateSegment"] },
    { attr: ["#css-month", "data-placeholder", "true"] },
    { attr: ["#css-bad-month", "aria-invalid", "true"] },
    { expect: ["#css-bad-error", "Value must be 10/31/2026 or earlier."] },
    { press: ["#css-month", "ArrowUp"] },
    { attr: ["#css-month", "data-placeholder", null] },
    { attr: ["#css-month", "aria-valuenow", "10"] },
  ],
});
