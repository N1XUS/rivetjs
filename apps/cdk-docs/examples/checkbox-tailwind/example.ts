import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox with Tailwind",
  summary: "A drawn checkbox: group on the CheckboxButton label, group-data-[selected]:, -[indeterminate]:, -[focus-visible]: and -[disabled]: on the box.",
  tags: ["checkbox", "tailwind", "styling"],
  status: "experimental",
  frame: { height: 116, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "label.group:has(#tw-cb)" },
    { absent: "label:has(#tw-cb) svg.check" },
    { click: "label:has(#tw-cb)" },
    { matches: "#tw-cb:checked" },
    { matches: "label[data-selected]:has(#tw-cb)" },
    { matches: "label:has(#tw-cb) svg.check" },
    { matches: "label[data-indeterminate]:has(#tw-mixed)" },
    { matches: "label[data-disabled]:has(#tw-off)" },
  ],
});
