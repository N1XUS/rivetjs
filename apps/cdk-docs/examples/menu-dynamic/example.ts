import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu dynamic items",
  summary: "items plus a render function build the menu from data; entries with children render a SubmenuTrigger whose Menu renders its own items.",
  tags: ["menu", "collections", "submenu"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#dy-trigger", "Enter"] },
    { focused: '[data-key="new"]' },
    { expect: ["#dy", "Open recent"] },
    { attr: ['[data-key="recent"]', "aria-haspopup", "menu"] },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: '[data-key="recent"]' },
    { key: "ArrowRight" },
    { focused: '[data-key="notes"]' },
    { key: "ArrowDown" },
    { key: "ArrowRight" },
    { focused: '[data-key="rivet"]' },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#dy-value", "site"] },
    { absent: '[role="menu"]' },
  ],
});
