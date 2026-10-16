import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeWheels: a TimeField with a drum popover",
  summary:
    "A TimeField whose clock button opens a popover of looped hour / minute drums and an AM / PM drum: spin, drag or type into either the drums or the segments, both edit the same value.",
  tags: ["aria", "date", "time", "wheel", "motion", "popover"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#alarm-minute", "ArrowUp"] },
    { expect: ["#value", "Value: 07:31:00"] },
    { click: "#alarm-wheels-button" },
    { attr: ["#alarm-wheels [data-type=minute]", "aria-valuenow", "31"] },
    { attr: ["#alarm-wheels [data-type=hour]", "role", "spinbutton"] },
    { press: ["#alarm-wheels [data-type=minute]", "ArrowDown"] },
    { expect: ["#value", "Value: 07:30:00"] },
    { attr: ["#alarm-minute", "aria-valuetext", "30"] },
    { press: ["#alarm-wheels [data-type=hour]", "ArrowUp"] },
    { expect: ["#value", "Value: 08:30:00"] },
    { wheel: ["#alarm-wheels [data-type=minute]", 100] },
    { expect: ["#value", "Value: 08:31:00"] },
    { press: ["#alarm-wheels [data-type=dayPeriod]", "ArrowUp"] },
    { expect: ["#value", "Value: 20:31:00"] },
    { key: "Escape" },
    { absent: "#alarm-wheels" },
    { attr: ["#alarm-dayPeriod", "aria-valuetext", "PM"] },
  ],
});
