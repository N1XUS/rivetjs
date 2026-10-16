import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: calendar options",
  summary: "firstDayOfWeek, pageBehavior, minValue / maxValue, isDateUnavailable and shouldCloseOnSelect={false} on the picker's calendar.",
  tags: ["aria", "date", "calendar"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#opts-button" },
    { matches: "#opts-dialog" },
    { focused: '[data-date="2026-10-14"]' },
    // Monday first: the first header cell is "M".
    { expect: ["#opts-dialog th", "M"] },
    // Before minValue: disabled; weekends: unavailable.
    { attr: ['[data-date="2026-10-02"]', "data-disabled", "true"] },
    { attr: ['[data-date="2026-10-17"]', "data-unavailable", "true"] },
    { click: '[data-date="2026-10-16"]' },
    // shouldCloseOnSelect={false}: still open.
    { matches: "#opts-dialog" },
    { expect: ["#value", "Value: 2026-10-16"] },
    { key: "Escape" },
    { absent: "#opts-dialog" },
    { expect: ["#opts-field", "10/16/2026"] },
  ],
});
