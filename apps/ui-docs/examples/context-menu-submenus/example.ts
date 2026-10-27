import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: With Submenus",
  summary: "A SubmenuTrigger opens a nested menu on hover or ArrowRight.",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      rightclick: "#cm-submenus [data-slot=context-menu-trigger]",
    },
    {
      hover: "[role=menuitem][data-key=share]",
    },
    {
      matches: "[role=menuitem][data-key=messages]",
    },
  ],
});
