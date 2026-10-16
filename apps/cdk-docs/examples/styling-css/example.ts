import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Styling with CSS",
  summary: "The same widgets in plain CSS: rules on the default rv-* classes and on aria-pressed, aria-selected, data-pressed, data-disabled and data-focused.",
  tags: ["styling", "css", "button", "listbox"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    // Default class names when the class prop is omitted.
    { attr: ["#bold", "class", "rv-ToggleButton"] },
    { attr: ["#save", "class", "rv-Button"] },
    { attr: ["#size", "class", "rv-ListBox"] },
    { attr: ['#size [data-key="s"]', "class", "rv-ListBoxItem"] },
    { click: "#bold" },
    { attr: ["#bold", "aria-pressed", "true"] },
    { matches: "#archive[data-disabled]:disabled" },
    { click: "#save" },
    { expect: ["#value", "Saved 1 time(s)"] },
    { attr: ['#size [data-key="l"]', "aria-disabled", "true"] },
    { click: '#size [data-key="s"]' },
    { attr: ['#size [data-key="s"]', "aria-selected", "true"] },
    { expect: ["#value", "size s"] },
    { key: "ArrowDown" },
    { attr: ['#size [data-key="m"]', "data-focused", "true"] },
    // RAC ListBox data-focused marks focus on the listbox element itself, not within it.
    { matches: "#size:not([data-focused]):focus-within" },
  ],
});
