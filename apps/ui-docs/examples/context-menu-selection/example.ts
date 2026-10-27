import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ContextMenu: With Selection",
  summary: "selectionMode turns items into checkable options; the menu stays a menu (menuitemcheckbox / menuitemradio).",
  tags: ["context-menu"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      rightclick: "#cm-selection [data-slot=context-menu-trigger]",
    },
    {
      attr: ["[role=menuitemradio][data-key=grid]", "aria-checked", "true"],
    },
    {
      click: "[role=menuitemradio][data-key=list]",
    },
    {
      expect: ["#cm-selection-state", "View: list"],
    },
  ],
});
