import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: With Suggestions",
  summary: "Suggestion pills under an empty composer fill the textarea (controlled `value`).",
  tags: ["prompt-input", "prompt-suggestion"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: ".prompt-suggestion__item:first-child" }, { absent: ".prompt-input__send[data-disabled]" }],
});
