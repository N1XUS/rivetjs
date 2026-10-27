import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: Controlled",
  summary: "Bind isOpen to a signal to follow (or force) the open state.",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#cm-controlled-state", "Menu is closed"],
    },
    {
      rightclick: "#cm-controlled [data-slot=context-menu-trigger]",
    },
    {
      expect: ["#cm-controlled-state", "Menu is open"],
    },
    {
      key: "Escape",
    },
    {
      expect: ["#cm-controlled-state", "Menu is closed"],
    },
  ],
});
