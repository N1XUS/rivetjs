import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox sections",
  summary: "Sections with headers (role=group named by a presentation header), item descriptions, keyboard ranges across sections.",
  tags: ["listbox", "sections"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#order section:nth-of-type(1)", "role", "group"] },
    { name: ["#order section:nth-of-type(1)", "Starters"] },
    { name: ["#order section:nth-of-type(3)", "Extras"] },
    { attr: ["#order section:nth-of-type(1) header", "role", "presentation"] },
    // Label and description slots name and describe the option.
    { name: ["#order-option-soup", "Soup"] },
    { described: ["#order-option-soup", "Tomato and basil"] },
    // Arrow keys and Shift ranges cross section boundaries.
    { click: "#order-option-salad" },
    { key: "Shift+ArrowDown" },
    { focused: "#order-option-risotto" },
    { expect: ["#order-value", "Order: risotto, salad"] },
    { key: "End" },
    { focused: "#order-option-bread" },
    // Typeahead uses the label.
    { key: "c" },
    { focused: "#order-option-curry" },
  ],
});
