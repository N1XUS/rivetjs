import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled tabs",
  summary: "Disable one item (isDisabled), several keys (disabledKeys) or the whole list (isDisabled on Tabs): disabled tabs are skipped and have no tabindex.",
  tags: ["aria", "tabs", "disabled"],
  status: "experimental",
  frame: { height: 353, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#item-tab-team", "aria-disabled", "true"] },
    { attr: ["#item-tab-team", "data-disabled", "true"] },
    { attr: ["#item-tab-team", "tabindex", null] },
    { press: ["#item-tab-pro", "ArrowRight"] },
    { focused: "#item-tab-enterprise" },
    { attr: ["#item-tab-enterprise", "aria-selected", "true"] },
    // disabledKeys: the default selection skips "free".
    { attr: ["#keys-tab-pro", "aria-selected", "true"] },
    { attr: ["#keys-tab-free", "aria-disabled", "true"] },
    { press: ["#keys-tab-pro", "ArrowRight"] },
    { focused: "#keys-tab-pro" },
    { key: "Home" },
    { focused: "#keys-tab-pro" },
    // isDisabled: every tab disabled, the first one still selected.
    { attr: ["#all", "data-disabled", "true"] },
    { attr: ["#all-tab-free", "aria-selected", "true"] },
    { attr: ["#all-tab-free", "aria-disabled", "true"] },
    { attr: ["#all-tab-pro", "tabindex", null] },
  ],
});
