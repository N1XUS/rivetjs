import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Launcher",
  summary: "An app launcher: apps and recent files with a header that says where the search runs.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-launcher-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      matches: "[data-slot=command-header]",
    },
    {
      click: "[role=menuitem][data-key=music]",
    },
    {
      expect: ["#cmd-launcher-ran", "Ran: music"],
    },
  ],
});
