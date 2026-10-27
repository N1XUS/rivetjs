import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Disabled",
  summary: "isDisabled dims the row and ignores presses; the switch keeps its value.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#cs-disabled [data-slot=switch]:has(input:checked:disabled)",
    },
    {
      attr: ["#cs-disabled [data-slot=switch]", "data-disabled", "true"],
    },
  ],
});
