import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Secondary",
  summary: "The secondary variant (filled shell) in three sizes.",
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".prompt-input[data-variant=secondary][data-size=lg]" }],
});
