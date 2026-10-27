import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Clean",
  summary: "No footer and no group headings: just the field and the commands, on a blurred backdrop.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-clean-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      matches: ".command__backdrop--blur",
    },
    {
      absent: "[data-slot=command-footer]",
    },
  ],
});
