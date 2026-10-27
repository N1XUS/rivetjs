import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Minimal",
  summary: "The small size with a transparent backdrop: a quick switcher.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-minimal-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      matches: ".command__dialog--sm",
    },
    {
      fill: ["[data-slot=command-input]", "zzz"],
    },
    {
      expect: ["[data-slot=command-list]", "No results"],
    },
  ],
});
