import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Usage",
  summary: "A settings row: the label on the start, the switch on the end; a press anywhere in the row toggles it.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#cs-basic [data-slot=switch]:not(:has(input:checked))",
    },
    {
      click: "#cs-basic [data-slot=switch-content]",
    },
    {
      matches: "#cs-basic [data-slot=switch]:has(input:checked)",
    },
  ],
});
