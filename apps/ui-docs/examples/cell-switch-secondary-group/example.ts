import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Secondary Group",
  summary: "Secondary rows on a gray panel: surface cells that keep the track visible.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#cs-secondary .cell-switch--secondary",
    },
    {
      matches: "#cs-secondary .cell-switch__trigger--secondary",
    },
  ],
});
