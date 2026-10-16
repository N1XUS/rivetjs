import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: DOM events and attributes",
  summary: "Global DOM events and attributes on the root and on each part: Group, DateInput, DateSegment, Button, Popover and Dialog.",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DatePicker", "lang", "en"] },
    { attr: ["#dom", "dir", "ltr"] },
    { attr: ["#dom-field", "translate", "no"] },
    { attr: ["#dom-button", "lang", "en"] },
    { click: "#dom-field-day" },
    { expect: ["#log", "root-enter segment-enter:day group-up"] },
    { click: "#dom-button" },
    { expect: ["#log", "group-up button-click"] },
    { matches: "#dom-dialog" },
    { attr: [".rv-Popover", "lang", "en"] },
    { rightclick: "#dom-dialog" },
    { expect: ["#log", "dialog-menu"] },
    { attr: ["#dom-dialog", "lang", "en"] },
    { key: "Escape" },
    { absent: "#dom-dialog" },
  ],
});
