import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptSuggestion: Cards",
  summary: "The card variant: title, description, tags and meta per suggestion.",
  tags: ["prompt-suggestion"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".prompt-suggestion--card .prompt-suggestion__item-tags" }],
});
