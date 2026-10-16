import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: DOM events and attributes",
  summary: "Global DOM attributes and events on each part: the root, the Group, both DateInputs, the segments, the Button, the Popover and the Dialog.",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DateRangePicker", "dir", "ltr"] },
    { attr: ["#dom", "lang", "en"] },
    { attr: ["#dom-start-day", "translate", "no"] },
    { attr: ["#dom-end-day", "translate", "no"] },
    { attr: ["#dom-button", "data-testid", "toggle"] },
    { click: "#dom-end-day" },
    { expect: ["#log", "root-enter group-down input-up:dom-end"] },
    { click: "#dom-button" },
    { expect: ["#log", "button-click"] },
    { matches: '.rv-Popover[lang="en"]' },
    { attr: ["#dom-dialog", "lang", "en"] },
    { key: "Escape" },
    { absent: "#dom-dialog" },
  ],
});
