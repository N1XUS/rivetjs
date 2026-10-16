import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Pagination: Page Size Select",
  summary: "Rivet-authored: the summary range is an InlineSelect picking the page size; pages and range follow, the first visible item stays in view.",
  tags: ["pagination", "inline-select"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=inline-select-value]", "1–10"] },
    { click: "[data-slot=pagination-next]" },
    { click: "[data-slot=pagination-next]" },
    { expect: ["[data-slot=inline-select-value]", "21–30"] },
    { click: "[data-slot=inline-select-trigger]" },
    { click: '[role=option][data-key="20"]' },
    { expect: ["[data-slot=inline-select-value]", "21–40"] },
    { expect: ["[data-slot=pagination-item]:nth-last-child(2)", "6"] },
    { expect: ["[data-slot=pagination-link][aria-current=page]", "2"] },
    { click: "[data-slot=inline-select-trigger]" },
    { click: '[role=option][data-key="100"]' },
    { expect: ["[data-slot=inline-select-value]", "1–100"] },
    { click: "[data-slot=pagination-next]" },
    { expect: ["[data-slot=inline-select-value]", "101–120"] },
    { attr: ["[data-slot=pagination-next]", "data-disabled", "true"] },
  ],
});
