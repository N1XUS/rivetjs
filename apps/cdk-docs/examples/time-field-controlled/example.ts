import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: controlled and uncontrolled",
  summary:
    "value as a two-way signal of the time string (buttons write it, editing writes back, onChange gets a Time); defaultValue for an uncontrolled field.",
  tags: ["aria", "date", "time", "forms", "state"],
  status: "experimental",
  frame: { height: 226, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#alarm-hour", "aria-valuenow", "7"] },
    { attr: ["#alarm-minute", "aria-valuenow", "15"] },
    { attr: ["#lunch-hour", "aria-valuetext", "12 PM"] },
    { click: "#noon" },
    { attr: ["#alarm-hour", "aria-valuetext", "12 PM"] },
    { attr: ["#alarm-minute", "aria-valuenow", "0"] },
    // Programmatic writes do not call onChange.
    { expect: ["#value", "last onChange: none"] },
    { press: ["#alarm-minute", "ArrowUp"] },
    { expect: ["#value", "Signal: 12:01:00 · last onChange: 12:01:00"] },
    { click: "#clear" },
    { attr: ["#alarm-hour", "data-placeholder", "true"] },
    { expect: ["#value", "Signal: null"] },
    { press: ["#lunch-hour", "ArrowUp"] },
    { attr: ["#lunch-hour", "aria-valuetext", "1 PM"] },
  ],
});
