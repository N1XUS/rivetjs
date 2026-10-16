import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled tabs",
  summary: "selectedKey is a two-way signal (set it from buttons, the tab stop follows); defaultSelectedKey only picks the first tab.",
  tags: ["aria", "tabs", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#checkout-tab-1", "data-key-type", "number"] },
    { attr: ["#docs-tab-css", "aria-selected", "true"] },
    { click: "#next" },
    { expect: ["#value", "Step: 2 (number)"] },
    { attr: ["#checkout-tab-2", "aria-selected", "true"] },
    { attr: ["#checkout-tab-2", "tabindex", "0"] },
    { attr: ["#checkout-tab-1", "tabindex", "-1"] },
    { expect: ["#checkout-tabpanel-2", "Step 2: Shipping"] },
    { click: "#next" },
    { expect: ["#value", "Step: 3 (number)"] },
    { press: ["#checkout-tab-3", "ArrowLeft"] },
    { expect: ["#value", "Step: 2 (number)"] },
    { click: "#prev" },
    { expect: ["#value", "Step: 1 (number)"] },
    { press: ["#docs-tab-css", "ArrowRight"] },
    { attr: ["#docs-tab-js", "aria-selected", "true"] },
  ],
});
