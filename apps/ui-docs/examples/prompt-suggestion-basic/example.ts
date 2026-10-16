import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptSuggestion: Usage",
  summary: "Starter prompts as pills above an empty composer.",
  tags: ["prompt-suggestion"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ click: ".prompt-suggestion__item:nth-child(2)" }, { expect: ["#picked", "Explain a SQL query"] }],
});
