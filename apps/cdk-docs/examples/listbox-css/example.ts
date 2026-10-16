import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox with plain CSS",
  summary:
    "No Tailwind: a stylesheet over rv-ListBox, rv-ListBoxSection, rv-Header and rv-ListBoxItem, with [aria-selected], [aria-disabled], [data-focused] and the description slot.",
  tags: ["listbox", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#plans.rv-ListBox" },
    { matches: "#plans .rv-ListBoxSection > .rv-Header" },
    { matches: "#plans-option-free.rv-ListBoxItem[aria-selected=true]" },
    { expect: ["#plans-option-pro [slot=description]", "Unlimited projects"] },
    { press: ["#plans-option-free", "ArrowDown"] },
    { attr: ["#plans-option-pro", "data-focused", "true"] },
    { key: "Enter" },
    { expect: ["#plan-value", "Plan: pro"] },
    { attr: ["#plans-option-team", "aria-disabled", "true"] },
  ],
});
