import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: controlled and uncontrolled",
  summary: "A value signal drives the segments both ways; onChange gets a date object; defaultValue seeds an uncontrolled field.",
  tags: ["aria", "date", "forms", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#due", "10/14/2026"] },
    { expect: ["#start", "10/1/2026"] },
    { click: "#xmas" },
    { expect: ["#due", "12/25/2026"] },
    { attr: ["#due-month", "aria-valuenow", "12"] },
    // Programmatic writes do not call onChange.
    { expect: ["#value", "last onChange: none"] },
    { press: ["#due-day", "ArrowDown"] },
    { expect: ["#value", "Signal: 2026-12-24 · last onChange: 2026-12-24"] },
    { click: "#clear" },
    { expect: ["#due", "mm/dd/yyyy"] },
    { expect: ["#value", "Signal: null"] },
    { press: ["#start-year", "ArrowUp"] },
    { expect: ["#start", "10/1/2027"] },
  ],
});
