import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu: Standalone",
  summary: "A Menu rendered in the page (no trigger, no popover): arrow keys move focus, Enter or a click runs onAction, a disabled key is skipped.",
  tags: ["menu"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#menu-standalone", "role", "menu"] },
    { click: '#menu-standalone [data-key="duplicate"]' },
    { expect: ["#menu-standalone-last", "duplicate"] },
    { key: "ArrowDown" },
    { focused: '#menu-standalone [data-key="share"]' },
    { key: "ArrowDown" },
    { focused: '#menu-standalone [data-key="delete"]' },
    { key: "Enter" },
    { expect: ["#menu-standalone-last", "delete"] },
    { attr: ['#menu-standalone [data-key="archive"]', "aria-disabled", "true"] },
  ],
});
