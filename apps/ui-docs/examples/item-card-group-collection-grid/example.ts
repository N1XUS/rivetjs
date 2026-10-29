import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroupCollection: Grid and Actions",
  summary:
    "ItemCardGroupCollection in grid layout (3 columns) from an items array: a press or Enter runs onAction, arrow keys move in two dimensions, a disabled row cannot be focused.",
  tags: ["item-card-group-collection", "item-card", "grid-list"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#icgc-grid", "data-layout", "grid"] },
    { click: '#icgc-grid [data-key="storage"]' },
    { expect: ["#icgc-opened", "storage"] },
    { key: "ArrowDown" },
    { focused: '#icgc-grid [data-key="email"]' },
    { key: "ArrowLeft" },
    { focused: '#icgc-grid [data-key="chat"]' },
    { key: "Enter" },
    { expect: ["#icgc-opened", "chat"] },
    { attr: ['#icgc-grid [data-key="webhooks"]', "aria-disabled", "true"] },
  ],
});
