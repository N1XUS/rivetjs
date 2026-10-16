import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup with Tailwind",
  summary:
    "A segmented control from a horizontal RadioGroup with Tailwind: class props per part, data-[selected]:, has-[:focus-visible]: and orientation-horizontal:.",
  tags: ["radio-group", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-view.inline-flex" },
    { click: "label:has(input[value='month'])" },
    { matches: "label[data-selected]:has(input[value='month'])" },
    { press: ["input[value='month']", "ArrowRight"] },
    { matches: "input[value='year']:checked" },
  ],
});
