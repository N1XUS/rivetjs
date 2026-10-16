import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: Time Picker",
  summary:
    "Rivet addition: TimePicker opens a popover of iOS-style wheel drums from the field (looped hour and minute drums, AM / PM); drums and segments edit the same value.",
  tags: ["time-field", "time-picker", "wheel", "motion", "popover"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#alarm-minute", "ArrowUp"] },
    { expect: ["#alarm-value", "Value: 07:31:00"] },
    { click: "#alarm-trigger" },
    { attr: ["#alarm-wheels [data-type=minute]", "aria-valuenow", "31"] },
    { press: ["#alarm-wheels [data-type=minute]", "ArrowDown"] },
    { expect: ["#alarm-value", "Value: 07:30:00"] },
    { attr: ["#alarm-minute", "aria-valuetext", "30"] },
    { wheel: ["#alarm-wheels [data-type=hour]", 100] },
    { expect: ["#alarm-value", "Value: 08:30:00"] },
    { press: ["#alarm-wheels [data-type=dayPeriod]", "ArrowUp"] },
    { expect: ["#alarm-value", "Value: 20:30:00"] },
    { key: "Escape" },
    { absent: "#alarm-wheels" },
    { attr: ["#alarm-dayPeriod", "aria-valuetext", "PM"] },
  ],
});
