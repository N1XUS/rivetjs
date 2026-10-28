import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Virtualized",
  summary: "10,000 rows with opt-in virtualization, sorting, selection and keyboard scrolling.",
  tags: ["table"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[role=grid][aria-rowcount="10001"]' },
    { absent: '[role=row][data-key="9999"]' },
    { click: '[role=columnheader][data-key="name"]' },
    { matches: '[role=columnheader][aria-sort="ascending"]' },
    { click: '[role=row][data-key="0"]' },
    { matches: '[role=row][data-key="0"][aria-selected=true]' },
    // A pointer press lands on a cell. Home then ArrowLeft enters row focus.
    { key: "Home" },
    { key: "ArrowLeft" },
    { focused: '[role=row][data-key="0"]' },
    { key: "ArrowDown" },
    { focused: '[role=row][data-key="1"]' },
    { key: "End" },
    { focused: '[role=row][data-key="9999"]' },
    { key: "Home" },
    { focused: '[role=row][data-key="0"]' },
  ],
});
