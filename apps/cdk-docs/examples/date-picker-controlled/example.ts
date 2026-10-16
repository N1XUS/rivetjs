import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: controlled",
  summary:
    "value and isOpen are two-way signals: buttons set or clear the date and open the calendar; onChange gets a date object; defaultValue for an uncontrolled picker.",
  tags: ["aria", "date", "state", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#due-field", "10/14/2026"] },
    { expect: ["#start-field", "10/1/2026"] },
    { click: "#today" },
    { expect: ["#due-field", "10/5/2026"] },
    // Programmatic writes do not call onChange.
    { expect: ["#picked", "Picked: --"] },
    { click: "#open" },
    { matches: "#due-dialog" },
    { expect: ["#value", "open: true"] },
    { attr: ['#due-dialog [data-date="2026-10-05"]', "data-selected", "true"] },
    { click: '[data-date="2026-10-09"]' },
    { absent: "#due-dialog" },
    { expect: ["#value", "Value: 2026-10-09 · open: false"] },
    { expect: ["#picked", "Picked: Friday, October 9, 2026"] },
    { click: "#clear" },
    { expect: ["#due-field", "mm/dd/yyyy"] },
    { expect: ["#value", "Value: none"] },
  ],
});
