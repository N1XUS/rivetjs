import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Aside shortcut",
  summary: 'asideToggleShortcut="mod+shift+e" toggles the aside from the keyboard (off by default).',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: '[data-slot="app-layout-main"] h1',
    },
    {
      key: "Control+Shift+KeyE",
    },
    {
      attr: ["#app-layout-aside-shortcut-aside", "data-state", "closed"],
    },
  ],
});
