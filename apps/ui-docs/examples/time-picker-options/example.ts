import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: Time Picker Options",
  summary:
    "Rivet addition: a 24-hour TimePicker with seconds, 5-minute and 15-second drums and opening hours (08:00 to 18:00): out-of-range drum rows are disabled and skipped.",
  tags: ["time-field", "time-picker", "wheel", "i18n"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#pickup-trigger" },
    { attr: ["#pickup-wheels [data-type=hour]", "aria-valuenow", "17"] },
    { absent: "#pickup-wheels [data-type=dayPeriod]" },
    { press: ["#pickup-wheels [data-type=hour]", "ArrowUp"] },
    { expect: ["#pickup-value", "Value: 18:00:00"] },
    { press: ["#pickup-wheels [data-type=hour]", "Home"] },
    { expect: ["#pickup-value", "Value: 08:00:00"] },
    { press: ["#pickup-wheels [data-type=minute]", "ArrowUp"] },
    { expect: ["#pickup-value", "Value: 08:05:00"] },
    { press: ["#pickup-wheels [data-type=second]", "End"] },
    { expect: ["#pickup-value", "Value: 08:05:45"] },
  ],
});
