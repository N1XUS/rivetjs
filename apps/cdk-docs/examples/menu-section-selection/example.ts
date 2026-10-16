import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu section-level selection",
  summary:
    "selectionMode / selectedKeys on a MenuSection: each section has its own selection (checkboxes, radios) next to plain action items in the same menu.",
  tags: ["menu", "selection", "sections"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#ss-trigger" },
    { attr: ['[data-key="cut"]', "role", "menuitem"] },
    { attr: ['[data-key="bold"]', "role", "menuitemcheckbox"] },
    { attr: ['[data-key="bold"]', "aria-checked", "true"] },
    { attr: ['[data-key="left"]', "role", "menuitemradio"] },
    { attr: ['[data-key="left"]', "aria-checked", "true"] },
    { click: '[data-key="italic"]' },
    { attr: ['[data-key="italic"]', "aria-checked", "true"] },
    { expect: ["#ss-style", "bold, italic"] },
    // The other sections keep their state.
    { attr: ['[data-key="left"]', "aria-checked", "true"] },
    { click: '[data-key="center"]' },
    { expect: ["#ss-align", "center"] },
    { expect: ["#ss-style", "bold, italic"] },
    { absent: "#ss" },
    { press: ["#ss-trigger", "Enter"] },
    { focused: '[data-key="cut"]' },
    { key: "Enter" },
    { expect: ["#ss-action", "cut"] },
    { expect: ["#ss-align", "center"] },
  ],
});
