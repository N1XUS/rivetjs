import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Split View",
  summary: "Commands on one side, details of the hovered or focused one on the other.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-split-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      hover: "[role=menuitem][data-key=routing]",
    },
    {
      expect: ["#cmd-split-preview", "File routing"],
    },
  ],
});
