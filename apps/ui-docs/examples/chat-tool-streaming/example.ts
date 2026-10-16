import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Streaming",
  summary: "A call moving through its states (input streaming, input ready, output) on a local timer; a keyed `Show` re-creates the tool per state.",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".chat-tool[data-state=input-streaming]" },
    { click: "#tool-run" },
    { matches: ".chat-tool[data-state=output-available]" },
    { expect: [".chat-tool__result", "24 °C"] },
  ],
});
