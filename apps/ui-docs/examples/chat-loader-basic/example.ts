import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatLoader: Usage",
  summary: "Placeholders for an assistant turn that has not produced text yet: dots, pulse, spinner and a skeleton.",
  tags: ["chat-loader"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[role=status][aria-label=Thinking]" }],
});
