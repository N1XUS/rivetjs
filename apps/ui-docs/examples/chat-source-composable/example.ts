import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatSource: Composable",
  summary: "Compose the pill and the preview from the parts.",
  tags: ["chat-source"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".chat-source__trigger", "ARIA patterns"] },
    { hover: ".chat-source__trigger" },
    { expect: [".chat-source__preview", "Authoring Practices"] },
  ],
});
