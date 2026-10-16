import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: forms",
  summary: "name posts the ISO time from a hidden input; isRequired blocks an empty submit with a native error; a form reset restores defaultValue.",
  tags: ["aria", "date", "time", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#time-input", "name", "time"] },
    { attr: ["#time-input", "required", ""] },
    { attr: ["#time-hour", "aria-required", "true"] },
    // An empty required field blocks the submit and shows the native message.
    { click: "#submit" },
    { expect: ["#value", "Submitted: nothing yet"] },
    { expect: ["#time-error", "Please fill out this field."] },
    { press: ["#time-hour", "9"] },
    { key: "4" },
    { key: "5" },
    { key: "a" },
    { press: ["#end-hour", "ArrowUp"] },
    { click: "#submit" },
    { expect: ["#value", "Submitted: time=09:45:00&end=18:00:00"] },
    { click: "#reset" },
    { attr: ["#end-hour", "aria-valuetext", "5 PM"] },
  ],
});
