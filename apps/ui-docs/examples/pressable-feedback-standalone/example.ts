import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Standalone Highlight",
  summary: "Highlight reacts to its parent's hover and press, so it also works inside other pressables such as a ui Button.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [],
});
