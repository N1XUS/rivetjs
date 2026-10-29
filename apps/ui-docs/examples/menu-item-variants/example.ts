import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "MenuItem: Variants and States",
  summary: "MenuItem with a render function (focus-dependent content), a disabled link item, and the danger variant; onAction reports the item key.",
  tags: ["menu", "menu-item"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['#menu-account [data-key="docs"]', "aria-disabled", "true"] },
    { click: '#menu-account [data-key="settings"]' },
    { expect: ["#menu-account-last", "settings"] },
    { key: "ArrowUp" },
    { focused: '#menu-account [data-key="profile"]' },
    { expect: ['#menu-account [data-key="profile"]', "Press Enter to open"] },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: '#menu-account [data-key="sign-out"]' },
    { key: "Enter" },
    { expect: ["#menu-account-last", "sign-out"] },
  ],
});
