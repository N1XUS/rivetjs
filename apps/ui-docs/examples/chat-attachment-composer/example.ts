import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatAttachment: Composer",
  summary: "Attach or drop files onto a PromptInput: the shell is the drop target, picked files show as removable chips.",
  tags: ["chat-attachment", "prompt-input"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".prompt-input__shell[data-chat-dropzone] [aria-label='Attach files']" },
    { fill: [".prompt-input__textarea", "Summarise these"] },
    { press: [".prompt-input__textarea", "Enter"] },
    { expect: ["#composer-sent", "Summarise these + 0 files"] },
  ],
});
