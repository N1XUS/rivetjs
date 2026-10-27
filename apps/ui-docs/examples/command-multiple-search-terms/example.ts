import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command: Multiple Search Terms",
  summary: "textValue carries extra words, so 'preferences' finds Settings and 'money' finds Billing.",
  tags: ["command"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cmd-terms-open",
    },
    {
      matches: "[data-slot=command-dialog][role=dialog]",
    },
    {
      fill: ["[data-slot=command-input]", "money"],
    },
    {
      matches: "[role=menuitem][data-key=billing]",
    },
    {
      absent: "[role=menuitem][data-key=settings]",
    },
  ],
});
