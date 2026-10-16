import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox",
  summary: "A single-selection list box: roving focus, arrow keys skip the disabled option, typeahead, Space selects.",
  tags: ["listbox", "selection", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#favourite", "role", "listbox"] },
    { attr: ["#favourite", "aria-multiselectable", null] },
    { name: ["#favourite", "Favourite fruit"] },
    { attr: ["#favourite-option-banana", "aria-selected", "true"] },
    // No focused key yet: the listbox is the tab stop (RA useSelectableCollection).
    { attr: ["#favourite", "tabindex", "0"] },
    { attr: ["#favourite-option-apple", "tabindex", "-1"] },
    { attr: ["#favourite-option-cherry", "aria-disabled", "true"] },
    { press: ["#favourite-option-banana", "ArrowDown"] },
    // Cherry is disabled: skipped. Moving focus does not select.
    { focused: "#favourite-option-date" },
    { attr: ["#favourite-option-date", "tabindex", "0"] },
    { attr: ["#favourite-option-date", "data-focused", "true"] },
    { attr: ["#favourite-option-banana", "aria-selected", "true"] },
    { key: "Space" },
    { attr: ["#favourite-option-date", "aria-selected", "true"] },
    { attr: ["#favourite-option-banana", "aria-selected", "false"] },
    { expect: ["#favourite-value", "Favourite: date"] },
    // Typeahead: "e" jumps to Elderberry.
    { key: "e" },
    { focused: "#favourite-option-elderberry" },
    { key: "Home" },
    { focused: "#favourite-option-apple" },
    { click: "#favourite-option-elderberry" },
    { expect: ["#favourite-value", "Favourite: elderberry"] },
  ],
});
