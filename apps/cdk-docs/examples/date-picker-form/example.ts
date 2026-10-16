import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: forms",
  summary:
    "name posts the ISO string through a hidden input; isRequired blocks an empty submit; form ties a picker to a form by id; a form reset restores defaultValue.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#appt-field-input", "name", "appointment"] },
    { attr: ["#appt-field-input", "required", ""] },
    { attr: ["#remote-field-input", "form", "booking"] },
    { click: "#submit" },
    // Blocked: the first invalid segment is focused and the error shows.
    { focused: "#appt-field-month" },
    { attr: [".rv-DatePicker:has(#appt)", "data-invalid", "true"] },
    { described: ["#appt", "Please fill out this field."] },
    { expect: ["#value", "Submitted: nothing yet"] },
    { click: "#appt-button" },
    { focused: '[data-date="2026-10-20"]' },
    { key: "Enter" },
    { absent: "#appt-dialog" },
    { expect: ["#appt-field", "10/20/2026"] },
    // The calendar pick commits validation (RS commitValue): the error goes away.
    { attr: [".rv-DatePicker:has(#appt)", "data-invalid", null] },
    { absent: "#appt-error" },
    { click: "#submit" },
    { expect: ["#value", "Submitted: appointment=2026-10-20&start=2026-10-14&remote=2026-12-01"] },
    { click: "#reset" },
    { expect: ["#appt-field", "mm/dd/yyyy"] },
  ],
});
