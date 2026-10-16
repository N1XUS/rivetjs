import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "WheelPicker: timer drums",
  summary:
    "Three drums in a WheelPicker for a countdown: looped hours, minutes and seconds that spin with drag, flick, wheel or keys and settle on an item; each drum is a spinbutton with a two-way signal.",
  tags: ["aria", "wheel", "motion", "spinbutton", "keyboard"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#timer", "role", "group"] },
    { attr: ["#timer-minutes", "role", "spinbutton"] },
    { attr: ["#timer-minutes", "aria-valuenow", "5"] },
    { attr: ["#timer-minutes", "aria-valuetext", "05 min"] },
    { press: ["#timer-minutes", "ArrowUp"] },
    { expect: ["#duration", "Duration: 0:06:00"] },
    { press: ["#timer-seconds", "ArrowDown"] },
    { expect: ["#duration", "Duration: 0:06:59"] },
    { press: ["#timer-hours", "End"] },
    { expect: ["#duration", "Duration: 23:06:59"] },
    { wheel: ["#timer-minutes", 100] },
    { expect: ["#duration", "Duration: 23:07:59"] },
    { attr: ["#timer-minutes [data-index='7']", "data-selected", "true"] },
  ],
});
