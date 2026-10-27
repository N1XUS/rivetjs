import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: With Sections",
  summary: "Group items under headings with sections and separators.",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      rightclick: "#cm-sections [data-slot=context-menu-trigger]",
    },
    {
      expect: ["[role=menu]", "Danger zone"],
    },
    {
      matches: "[role=menu] [role=separator]",
    },
  ],
});
