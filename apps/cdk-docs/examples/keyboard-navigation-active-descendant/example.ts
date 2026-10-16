import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ActiveDescendantKeyManager",
  summary: "Focus stays on the listbox; the manager moves aria-activedescendant and data-active. No wrap, PageUp and PageDown by 3, Home and End.",
  tags: ["keyboard", "key-manager", "aria-activedescendant"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#ad", "aria-activedescendant", null] },
    { press: ["#ad", "ArrowDown"] },
    // Nothing active yet: the first item.
    { attr: ["#ad", "aria-activedescendant", "ad-1"] },
    { attr: ["#ad-1", "data-active", ""] },
    { focused: "#ad" },
    { key: "PageDown" },
    { attr: ["#ad", "aria-activedescendant", "ad-4"] },
    { attr: ["#ad-1", "data-active", null] },
    { key: "End" },
    { attr: ["#ad", "aria-activedescendant", "ad-8"] },
    // No wrap: ArrowDown at the end stays.
    { key: "ArrowDown" },
    { attr: ["#ad", "aria-activedescendant", "ad-8"] },
    { key: "PageUp" },
    { attr: ["#ad", "aria-activedescendant", "ad-5"] },
    { key: "Home" },
    { attr: ["#ad", "aria-activedescendant", "ad-1"] },
    { key: "Enter" },
    { attr: ["#ad-1", "aria-selected", "true"] },
    { expect: ["#ad-value", "Item 1"] },
    { focused: "#ad" },
  ],
});
