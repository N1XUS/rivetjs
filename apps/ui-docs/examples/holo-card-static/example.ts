import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: Static",
  summary: "isInteractive={false} keeps the card flat and unlit; so does prefers-reduced-motion.",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#hc-static", "data-static", "true"],
    },
  ],
});
