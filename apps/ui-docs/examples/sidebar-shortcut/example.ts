import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: keyboard shortcut",
  summary: "toggleShortcut mod+shift+s replaces Cmd/Ctrl+B; toggleShortcut false turns the shortcut off.",
  tags: ["sidebar", "keyboard"],
  status: "experimental",
  frame: { height: 360, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#ssc-home" },
    { key: "Control+b" },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
    { key: "Control+Shift+S" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
