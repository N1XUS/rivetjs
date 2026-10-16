import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Multiple selection",
  summary:
    'selectionMode="multiple": a Key[] value, the trigger lists the labels, the popover stays open; shouldCloseOnSelect overrides the default both ways.',
  tags: ["select", "multiple"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    // The trigger shows the labels as a localized list.
    { expect: ["#toppings-value", "Cheese and Olives"] },
    { click: "#toppings-trigger" },
    { attr: ["#toppings-listbox", "aria-multiselectable", "true"] },
    { attr: ["#toppings-listbox-option-cheese", "aria-selected", "true"] },
    { attr: ["#toppings-listbox-option-ham", "aria-selected", "false"] },
    // Clicks toggle; the popover stays open.
    { click: "#toppings-listbox-option-ham" },
    { matches: "#toppings-listbox" },
    { expect: ["#toppings-out", "[cheese, olives, ham]"] },
    { expect: ["#toppings-value", "Cheese, Olives, and Ham"] },
    { click: "#toppings-listbox-option-cheese" },
    { expect: ["#toppings-out", "[olives, ham]"] },
    // Space toggles the focused option too.
    { focused: "#toppings-listbox-option-cheese" },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: "#toppings-listbox-option-pepper" },
    { key: " " },
    { expect: ["#toppings-out", "[olives, ham, pepper]"] },
    { key: "Escape" },
    { absent: "#toppings-listbox" },
    // shouldCloseOnSelect on a multiple select.
    { click: "#extras-trigger" },
    { click: "#extras-listbox-option-ham" },
    { absent: "#extras-listbox" },
    { expect: ["#extras-value", "Ham"] },
    // shouldCloseOnSelect={false} on a single select.
    { click: "#base-trigger" },
    { click: "#base-listbox-option-olives" },
    { matches: "#base-listbox" },
    { expect: ["#base-value", "Olives"] },
    { key: "Escape" },
    { absent: "#base-listbox" },
  ],
});
