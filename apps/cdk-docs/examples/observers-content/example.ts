import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "observeContent()",
  summary: "Content changes of an element, from a client effect: every change, or one call per quiet period with debounce; comment-only changes are ignored.",
  tags: ["cdk", "observers", "events", "options"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#changes", "Changes: 0"] },
    { click: "#add" },
    { expect: ["#changes", "Changes: 1"] },
    { click: "#add" },
    { click: "#add" },
    { expect: ["#changes", "Changes: 3"] },
    { expect: ["#batches", "Debounced (1 s): 1"] },
    { click: "#comment" },
    { click: "#add" },
    { expect: ["#changes", "Changes: 4"] },
    { expect: ["#list li:nth-child(5)", "Item 5"] },
  ],
});
