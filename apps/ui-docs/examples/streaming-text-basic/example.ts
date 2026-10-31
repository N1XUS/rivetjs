import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "StreamingText: Usage",
  summary: "Bursts of words become a continuous letter reveal, with subtle opacity and natural wrapping.",
  tags: ["streaming-text"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#text-stream" },
    { matches: "#text-live[data-revealing]" },
    { expect: ["#text-live", "Emoji stay together"] },
    { absent: "#text-live[data-revealing]" },
  ],
});
