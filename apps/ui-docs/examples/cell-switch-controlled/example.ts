import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Controlled",
  summary: "Bind the selection to a signal and read it elsewhere on the page.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#cs-controlled-state", "Auto-update is on."],
    },
    {
      click: "#cs-controlled [data-slot=switch-content]",
    },
    {
      expect: ["#cs-controlled-state", "Auto-update is off."],
    },
  ],
});
