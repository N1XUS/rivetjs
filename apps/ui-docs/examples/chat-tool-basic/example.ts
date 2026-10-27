import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Usage",
  summary: "A finished tool call: the trigger shows the tool and its status, the content its input and result.",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".chat-tool[data-state=output-available]" },
    { click: ".chat-tool__trigger" },
    { attr: [".chat-tool__trigger", "aria-expanded", "true"] },
    { expect: [".chat-tool__result", "sunny"] },
  ],
});
