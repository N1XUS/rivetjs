import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Usage",
  summary: "The chat composer: autosizing textarea, toolbar actions with tooltips, Send. Enter sends, Shift+Enter adds a line.",
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".prompt-input__send[data-disabled]" },
    { fill: ["#pi-text", "Plan a trip to Porto"] },
    { press: ["#pi-text", "Enter"] },
    { expect: ["#pi-sent", "Plan a trip to Porto"] },
  ],
});
