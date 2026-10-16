import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox with Tailwind",
  summary: "Tailwind classes through class, optionClass, sectionClass and headerClass, styled with aria-selected:, aria-disabled: and focused: variants.",
  tags: ["listbox", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Your class replaces the default rv-* class.
    { matches: "#palette.grid:not(.rv-ListBox)" },
    { matches: "#palette-option-blue.rounded-md[aria-selected=true]" },
    { expect: ["#palette-option-blue", "selected"] },
    { press: ["#palette-option-blue", "ArrowUp"] },
    // Orange is disabled: skipped.
    { focused: "#palette-option-red" },
    { attr: ["#palette-option-red", "data-focused", "true"] },
    { key: "Space" },
    { attr: ["#palette-option-red", "aria-selected", "true"] },
    { expect: ["#palette-option-red", "selected"] },
  ],
});
