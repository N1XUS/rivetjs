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
      contextmenu: "#cm-submenus [data-slot=context-menu-trigger]",
    },
    {
      hover: "[role=menuitem][data-key=share]",
    },
    {
      matches: "[data-slot=context-menu-popover][data-trigger=SubmenuTrigger][data-placement] [role=menuitem][data-key=messages]",
    },
    // The submenu's .Menu renders inside its .Popover, not in a second (never positioned) dropdown popover.
    {
      absent: "[data-slot=dropdown-popover]",
    },
  ],
});
