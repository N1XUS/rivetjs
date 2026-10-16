import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu disabled items",
  summary: "disabledKeys on the Menu or isDisabled on a MenuItem: disabled items get aria-disabled, are skipped by the keyboard and never call onAction.",
  tags: ["menu", "disabled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#d-trigger" },
    { attr: ['[data-key="paste"]', "aria-disabled", "true"] },
    { attr: ['[data-key="paste"]', "data-disabled", "true"] },
    { attr: ['[data-key="delete"]', "aria-disabled", "true"] },
    { attr: ['[data-key="copy"]', "aria-disabled", null] },
    // (Playwright will not click an aria-disabled element, so the pointer case is covered by the RAC tests.)
    { expect: ["#d-value", "nothing yet"] },
    { key: "Escape" },
    { absent: "#d" },
    // The keyboard skips both disabled items.
    { press: ["#d-trigger", "Enter"] },
    { focused: '[data-key="cut"]' },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: '[data-key="rename"]' },
    { key: "Enter" },
    { expect: ["#d-value", "rename"] },
  ],
});
