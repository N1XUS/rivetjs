import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: Usage",
  summary: "Right-click the area to open a menu at the pointer; pick an item or press Escape to close it.",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      absent: "[role=menu]",
    },
    {
      contextmenu: "#cm-basic [data-slot=context-menu-trigger]",
    },
    {
      matches: "[role=menu] [role=menuitem]",
    },
    {
      click: "[role=menuitem][data-key=reload]",
    },
    {
      expect: ["#cm-basic-last", "Last action: reload"],
    },
    {
      absent: "[role=menu]",
    },
  ],
});
