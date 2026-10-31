import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Markdown: Streaming",
  summary:
    "A reply streamed from a local timer with a natural cadence: a shimmering “Thinking…” first, then letters flow in, finished blocks keep their nodes, the height grows smoothly and a soft caret follows the text.",
  tags: ["markdown"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#md-stream" },
    { matches: ".text-shimmer" },
    { matches: "#md-live .markdown__character" },
    { expect: ["#md-live", "Done."] },
    { absent: "#md-live .markdown__caret" },
    { matches: "#md-live .code-block .code-block__token--keyword" },
  ],
});
