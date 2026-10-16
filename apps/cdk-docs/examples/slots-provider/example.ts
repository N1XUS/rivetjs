import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slots: Provider and slot contexts",
  summary: "A custom Card provides HeadingContext and TextContext slots with one Provider; the parts inside pick their ids, level and class from the slot.",
  tags: ["slots", "provider", "context"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "h2#card-title.card-title" },
    { attr: ["#card", "aria-labelledby", "card-title"] },
    { attr: ["#card", "aria-describedby", "card-desc"] },
    { expect: ["#card-desc", "Ships in 2 days"] },
    { matches: "#card-note[slot=note]" },
  ],
});
