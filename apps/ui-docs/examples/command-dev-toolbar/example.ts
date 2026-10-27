import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Dev Toolbar",
  summary: "Developer actions with keyboard shortcuts and descriptions, in the large size.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-dev-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      matches: ".command__dialog--lg",
    },
    {
      fill: ["[data-slot=command-input]", "branch"],
    },
    {
      press: ["[data-slot=command-input]", "Enter"],
    },
    {
      expect: ["#cmd-dev-ran", "Ran: branch"],
    },
  ],
});
