import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled, read-only and labelled TextFields",
  summary: "isDisabled, isReadOnly and isRequired on a TextField, and fields named by aria-label or aria-labelledby instead of a visible label.",
  tags: ["text-field", "disabled", "read-only", "labels"],
  status: "experimental",
  frame: { height: 354, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tf-off", "disabled", ""] },
    { matches: "div[data-disabled]:has(> #tf-off)" },
    { matches: "#tf-off[data-disabled]" },
    { attr: ["#tf-ro", "readonly", ""] },
    { matches: "div[data-readonly]:has(> #tf-ro)" },
    { attr: ["#tf-req", "required", ""] },
    { matches: "div[data-required]:has(> #tf-req)" },
    { attr: ["#tf-search2", "aria-label", "Search the docs"] },
    { attr: ["#tf-search2", "type", "search"] },
    { name: ["#tf-qty", "Quantity"] },
  ],
});
