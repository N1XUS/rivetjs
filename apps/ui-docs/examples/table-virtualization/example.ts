import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Virtualization",
  summary: 'Table demo "Virtualization".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: '[role=row][data-key="1000"]' },
    { click: '[role=row][data-key="1"]' },
    { matches: '[role=row][data-key="1"][aria-selected=true]' },
    // A pointer press lands on a cell. Home then ArrowLeft enters row focus.
    { key: "Home" },
    { key: "ArrowLeft" },
    { focused: '[role=row][data-key="1"]' },
    { key: "ArrowDown" },
    { focused: '[role=row][data-key="2"]' },
    { key: "End" },
    { focused: '[role=row][data-key="1000"]' },
    { key: "Home" },
    { focused: '[role=row][data-key="1"]' },
  ],
});
