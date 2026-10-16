import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup with Tailwind",
  summary:
    "A CheckboxGroup styled as selectable cards with Tailwind: class props on every part and data-[selected]:, -[focus-visible]:, -[disabled]: on each label.",
  tags: ["checkbox-group", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-cg.grid" },
    { matches: "label[data-selected]:has(input[value='web'])" },
    { click: "label:has(input[value='mobile'])" },
    { matches: "label[data-selected]:has(input[value='mobile'])" },
    { matches: "input[value='mobile']:checked" },
    { matches: "label[data-disabled]:has(input[value='tv'])" },
  ],
});
