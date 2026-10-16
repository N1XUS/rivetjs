import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup content",
  summary: "A rich group Label, CheckboxButton render props drawing the content, a per-checkbox description, and the group's state render prop.",
  tags: ["checkbox-group", "slots", "render-props"],
  status: "experimental",
  frame: { height: 192, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { name: ["#plans", "Add-ons (monthly)"] },
    { expect: ["label:has(input[value='pro'])", "$12"] },
    { described: ["input[value='pro']", "Answers within a day."] },
    { absent: "label:has(input[value='pro']) svg.check" },
    { click: "label:has(input[value='pro'])" },
    { matches: "label[data-selected]:has(input[value='pro'])" },
    { matches: "label:has(input[value='pro']) svg.check" },
    { expect: ["#count", "1 selected"] },
  ],
});
