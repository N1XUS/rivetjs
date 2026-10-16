import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu selection",
  summary:
    "selectionMode single / multiple turns items into menuitemradio / menuitemcheckbox; a Signal as selectedKeys is two-way, and multiple selection keeps the menu open.",
  tags: ["menu", "selection", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#sel-view-value", "rulers"] },
    { click: "#sel-view-trigger" },
    { attr: ['[data-key="rulers"]', "role", "menuitemcheckbox"] },
    { attr: ['[data-key="rulers"]', "aria-checked", "true"] },
    { attr: ['[data-key="grid"]', "aria-checked", "false"] },
    { matches: '[data-key="rulers"] svg.check' },
    { click: '[data-key="grid"]' },
    { attr: ['[data-key="grid"]', "aria-checked", "true"] },
    { matches: '[data-key="grid"][data-selected] svg.check' },
    // multiple: still open after the toggle.
    { matches: "#sel-view" },
    { expect: ["#sel-view-value", "rulers, grid"] },
    { key: "Space" },
    { attr: ['[data-key="grid"]', "aria-checked", "false"] },
    { expect: ["#sel-view-value", "rulers"] },
    { key: "Escape" },
    { absent: "#sel-view" },
    // single: radios; selecting replaces the key and closes the menu.
    { press: ["#sel-align-trigger", "Enter"] },
    { attr: ['[data-key="left"]', "role", "menuitemradio"] },
    { attr: ['[data-key="left"]', "aria-checked", "true"] },
    { key: "ArrowDown" },
    { key: "Enter" },
    { absent: "#sel-align" },
    { expect: ["#sel-align-value", "center"] },
    { click: "#sel-align-trigger" },
    { attr: ['[data-key="center"]', "aria-checked", "true"] },
    { attr: ['[data-key="left"]', "aria-checked", "false"] },
    { key: "Escape" },
    { absent: "#sel-align" },
    // Your code owns the signal.
    { click: "#sel-reset" },
    { expect: ["#sel-view-value", "none"] },
    { click: "#sel-view-trigger" },
    { attr: ['[data-key="rulers"]', "aria-checked", "false"] },
  ],
});
