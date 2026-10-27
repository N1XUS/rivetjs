import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: With Pattern",
  summary:
    "--holo-card-pattern and --holo-card-pattern-size restyle the texture both overlays use; an image texture is a stylesheet rule (inline styles refuse url()).",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [],
});
