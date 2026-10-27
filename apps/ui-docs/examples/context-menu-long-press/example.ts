import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: Long Press",
  summary: "On touch screens a long press opens the menu (iOS fires no contextmenu event, so the trigger times the press itself).",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      rightclick: "#cm-long-press [data-slot=context-menu-trigger]",
    },
    {
      matches: "[role=menuitem][data-key=share]",
    },
  ],
});
