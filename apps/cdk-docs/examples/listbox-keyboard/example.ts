import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox keyboard options",
  summary: 'shouldFocusWrap wraps arrow keys at the ends and escapeKeyBehavior="none" keeps the selection on Escape.',
  tags: ["listbox", "keyboard"],
  status: "experimental",
  frame: { height: 218, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#wrap-option-mercury", "ArrowUp"] },
    { focused: "#wrap-option-mars" },
    { key: "ArrowDown" },
    { focused: "#wrap-option-mercury" },
    // PageDown / End go to the last option.
    { key: "PageDown" },
    { focused: "#wrap-option-mars" },
    { press: ["#keep-option-venus", "Escape"] },
    { expect: ["#keep-value", "mars, venus"] },
  ],
});
