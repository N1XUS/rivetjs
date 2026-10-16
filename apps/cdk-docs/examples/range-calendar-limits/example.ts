import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: limits and unavailable dates",
  summary: "minValue / maxValue bound the range; once a start is picked, dates past an unavailable day are disabled unless allowsNonContiguousRanges.",
  tags: ["cdk", "range-calendar", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ['#contiguous [data-date="2026-10-04"]', "aria-disabled", "true"] },
    { attr: ['#contiguous [data-date="2026-10-31"]', "aria-disabled", "true"] },
    { attr: ['#contiguous [data-date="2026-10-14"]', "data-unavailable", "true"] },
    { attr: ['#contiguous [data-date="2026-10-14"]', "aria-disabled", "true"] },
    // Anchored on the 12th: the 16th lies past the booked 14th, so it is disabled.
    { click: '#contiguous [data-date="2026-10-12"]' },
    { attr: ['#contiguous [data-date="2026-10-16"]', "aria-disabled", "true"] },
    { attr: ['#contiguous [data-date="2026-10-16"]', "data-disabled", "true"] },
    { click: '#contiguous [data-date="2026-10-13"]' },
    { expect: ["#contiguous-value", "2026-10-12 → 2026-10-13"] },
    { attr: ['#contiguous [data-date="2026-10-16"]', "data-disabled", null] },
    // Spanning the booked day: a click anchors (the value is still empty), the keyboard extends the range.
    { click: '#spanning [data-date="2026-10-12"]' },
    { expect: ["#spanning-value", "none"] },
    { focused: '#spanning [data-date="2026-10-12"]' },
    { attr: ['#spanning [data-date="2026-10-16"]', "aria-disabled", null] },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { focused: '#spanning [data-date="2026-10-16"]' },
    { key: "Enter" },
    { expect: ["#spanning-value", "2026-10-12 → 2026-10-16"] },
    { attr: ['#spanning [data-date="2026-10-15"]', "data-selected", "true"] },
    { attr: ['#spanning [data-date="2026-10-14"]', "data-selected", null] },
  ],
});
