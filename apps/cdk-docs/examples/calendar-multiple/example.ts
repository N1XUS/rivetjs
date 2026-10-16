import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: multiple selection",
  summary: "selectionMode multiple: every press toggles a day; the value is an array of ISO strings and the grid is aria-multiselectable.",
  tags: ["cdk", "calendar", "selection"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cal table", "aria-multiselectable", "true"] },
    { attr: ['#cal [data-date="2026-10-05"]', "data-selected", "true"] },
    { attr: ['#cal [data-date="2026-10-07"]', "data-selected", "true"] },
    { click: '#cal [data-date="2026-10-12"]' },
    { expect: ["#value", "Days: 2026-10-05, 2026-10-07, 2026-10-12"] },
    { click: '#cal [data-date="2026-10-07"]' },
    { expect: ["#value", "Days: 2026-10-05, 2026-10-12"] },
    { attr: ['#cal [data-date="2026-10-07"]', "data-selected", null] },
    { press: ['#cal [data-date="2026-10-07"]', "ArrowRight"] },
    { key: "Space" },
    { expect: ["#value", "Days: 2026-10-05, 2026-10-12, 2026-10-08"] },
    { click: "#clear" },
    { expect: ["#value", "Days: none"] },
  ],
});
