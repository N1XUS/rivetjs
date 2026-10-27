import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Usage",
  summary: "A command palette: type to filter, arrows move, Enter runs the highlighted command, Escape clears and then closes.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-basic-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      focused: "[data-slot=command-input]",
    },
    {
      fill: ["[data-slot=command-input]", "bill"],
    },
    {
      absent: "[role=menuitem][data-key=calendar]",
    },
    {
      press: ["[data-slot=command-input]", "Enter"],
    },
    {
      expect: ["#cmd-basic-ran", "Ran: billing"],
    },
    {
      absent: "[data-slot=command-dialog]",
    },
  ],
});
