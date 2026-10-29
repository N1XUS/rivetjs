import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateInputGroup: Parts",
  summary:
    "DateInputGroup Root, Prefix, Input, Segment and Suffix inside a DateField and a TimeField (the same parts as their Group / Input / Segment / Prefix / Suffix), primary and secondary full-width variants.",
  tags: ["date-input-group", "date-field", "time-field"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#dig-day-value", "2026-03-14"] },
    { press: ["#dig-day [data-type=day]", "ArrowUp"] },
    { expect: ["#dig-day-value", "2026-03-15"] },
    { matches: "[data-slot=date-input-group].date-input-group--secondary.date-input-group--full-width [data-type=hour]" },
  ],
});
