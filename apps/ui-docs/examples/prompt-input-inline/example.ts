import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Inline",
  summary: 'One row: actions, textarea and Send side by side (`layout="inline"`).',
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".prompt-input[data-layout=inline]" }],
});
