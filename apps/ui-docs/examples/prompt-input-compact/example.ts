import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Compact",
  summary: 'A single line that expands into the stacked layout once the text wraps (`layout="compact"`).',
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".prompt-input[data-layout=compact]" }, { absent: ".prompt-input[data-expanded]" }],
});
