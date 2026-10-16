import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Theme compare: light and dark",
  summary:
    'The same card and form twice, side by side: one subtree under data-theme="light", one under data-theme="dark". The theme is a set of variables on any element, so both render on one page whatever the site theme is.',
  tags: ["theme", "dark-mode", "card", "form"],
  status: "experimental",
  frame: { height: 420, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#tc-light", "data-theme", "light"] },
    { attr: ["#tc-dark", "data-theme", "dark"] },
    { click: "#tc-dark-save" },
    { expect: ["#tc-dark-save", "Saved"] },
  ],
});
