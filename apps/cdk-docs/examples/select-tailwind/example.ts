import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select with Tailwind",
  summary:
    "Tailwind classes through the class props, with data-[open]:, data-[placeholder]:, aria-selected:, focused:, entering: / exiting: variants and enter / leave transition props.",
  tags: ["select", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw.grid" },
    { matches: "#tw-trigger.rounded-md" },
    { matches: "#tw-value.truncate[data-placeholder]" },
    { click: "#tw-trigger" },
    { matches: "#tw[data-open]" },
    { matches: "#tw-popover.shadow-lg[data-placement^=bottom]" },
    { matches: "#tw-listbox.grid" },
    // Mouse open without a value focuses the listbox; ArrowDown focuses the first option.
    { focused: "#tw-listbox" },
    { key: "ArrowDown" },
    { matches: "#tw-listbox-option-apple.rounded[data-focused]" },
    { key: "ArrowDown" },
    { key: "Enter" },
    { absent: "#tw-popover" },
    { expect: ["#tw-value", "Banana"] },
    { absent: "#tw-value[data-placeholder]" },
    // The transition props: enter classes while opening, leave classes while closing, then gone.
    { click: "#tw2-trigger" },
    { matches: "#tw2-popover" },
    { press: ["#tw2-listbox", "ArrowDown"] },
    { matches: "#tw2-listbox-option-apple[data-focused]" },
    { key: "Escape" },
    { absent: "#tw2-popover" },
  ],
});
