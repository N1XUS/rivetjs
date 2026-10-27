import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: Disabled",
  summary: "isDisabled turns the custom menu off: a right click shows the browser's own menu. Items can be disabled one by one too.",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#cm-disabled [data-slot=context-menu-trigger]", "data-disabled", "true"],
    },
    {
      contextmenu: "#cm-disabled-items",
    },
    {
      attr: ["[role=menuitem][data-key=paste]", "aria-disabled", "true"],
    },
  ],
});
