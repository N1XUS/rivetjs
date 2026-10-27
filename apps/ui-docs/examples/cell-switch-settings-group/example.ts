import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Settings Group",
  summary: "A titled settings section: rows with descriptions, joined into one block.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#cs-settings", "Read receipts"],
    },
    {
      matches: "#cs-settings [data-slot=cell-switch-description]",
    },
  ],
});
