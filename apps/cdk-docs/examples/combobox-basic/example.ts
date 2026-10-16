import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox",
  summary: "A combo box over data items: typing filters the cities ignoring case and accents; arrow keys move the virtually focused option while focus stays in the input.",
  tags: ["combobox", "autocomplete", "keyboard"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#city", "role", "combobox"] },
    { attr: ["#city", "aria-expanded", "false"] },
    { name: ["#city", "City"] },
    { absent: "[role=listbox]" },
    // "bog" matches Bogotá only (accents ignored).
    { fill: ["#city", "bog"] },
    { attr: ["#city", "aria-expanded", "true"] },
    { matches: '[role=option][data-key="bog"]' },
    { absent: '[role=option][data-key="ber"]' },
    { key: "ArrowDown" },
    { attr: ['[role=option][data-key="bog"]', "data-focused", "true"] },
    { focused: "#city" },
    { key: "Enter" },
    { attr: ["#city", "aria-expanded", "false"] },
    { expect: ["#value", "Selected: bog"] },
    { attr: ['input[type="hidden"][name="city"]', "value", "bog"] },
    // The button opens every option.
    { click: 'button[aria-label="Show cities"]' },
    { matches: '[role=option][data-key="ber"]' },
    { key: "Escape" },
    { absent: "[role=listbox]" },
  ],
});
