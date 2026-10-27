import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Variants",
  summary: "default: gray cells on a page; secondary: surface cells inside gray containers.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#cs-variants .cell-switch__trigger--default",
    },
    {
      matches: "#cs-variants .cell-switch__trigger--secondary",
    },
  ],
});
