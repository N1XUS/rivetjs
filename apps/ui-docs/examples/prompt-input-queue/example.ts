import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Queue",
  summary: "Prompts queued while a response runs, above the composer; each row can be removed.",
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".prompt-input__queue-list", "Then write the tests"] },
    { click: ".prompt-input__queue-item:first-child [aria-label='Remove from queue']" },
    { absent: ".prompt-input__queue-item:nth-child(2)" },
  ],
});
