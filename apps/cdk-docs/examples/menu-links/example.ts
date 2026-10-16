import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu with links",
  summary: "Items with an href render as links: activating one navigates and closes the menu.",
  tags: ["menu", "links"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/routes/help.tsx"],
  test: [
    { press: ["#go-trigger", "Enter"] },
    { matches: '#go a[role="menuitem"][data-key="help"]' },
    { matches: '#go div[role="menuitem"][data-key="print"]' },
    { attr: ['[data-key="disabled-link"]', "aria-disabled", "true"] },
    { focused: '[data-key="print"]' },
    { key: "Enter" },
    { expect: ["#go-value", "Last action: print"] },
    { absent: "#go" },
    // A disabled link is skipped by the arrow keys.
    { press: ["#go-trigger", "Enter"] },
    { focused: '[data-key="print"]' },
    { key: "ArrowDown" },
    { focused: '[data-key="help"]' },
    { key: "ArrowDown" },
    { focused: '[data-key="print"]' },
    // Enter on a link closes the menu and navigates.
    { key: "ArrowDown" },
    { focused: '[data-key="help"]' },
    { key: "Enter" },
    { expect: ["#help-title", "Help page"] },
  ],
});
