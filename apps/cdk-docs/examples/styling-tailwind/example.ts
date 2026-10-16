import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Styling with Tailwind",
  summary:
    "Button, ToggleButton and ListBox styled with Tailwind classes: aria-pressed:, aria-selected:, data-pressed:, data-disabled:, data-focused: and focused:.",
  tags: ["styling", "tailwind", "button", "listbox"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // A class prop replaces the default rv-* class.
    { attr: ["#bold", "aria-pressed", "false"] },
    { click: "#bold" },
    { attr: ["#bold", "aria-pressed", "true"] },
    { matches: "#archive[data-disabled]:disabled" },
    { attr: ["#save", "data-disabled", null] },
    { click: "#save" },
    { expect: ["#value", "Saved 1 time(s)"] },
    { attr: ['#size [data-key="m"]', "aria-selected", "true"] },
    { attr: ['#size [data-key="l"]', "data-disabled", "true"] },
    { click: '#size [data-key="xl"]' },
    { attr: ['#size [data-key="xl"]', "aria-selected", "true"] },
    { attr: ['#size [data-key="xl"]', "data-selected", "true"] },
    { attr: ['#size [data-key="m"]', "aria-selected", "false"] },
    { expect: ["#value", "size xl"] },
    { key: "ArrowUp" },
    { attr: ['#size [data-key="m"]', "data-focused", "true"] },
    // RAC ListBox data-focused marks focus on the listbox element itself, not within it.
    { matches: "#size:not([data-focused]):focus-within" },
  ],
});
