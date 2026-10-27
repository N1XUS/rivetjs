import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: Credit Card",
  summary: "Swap --holo-card-width and --holo-card-height for a landscape card (ID-1 proportions, 85.6 \u00d7 54 mm).",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [],
});
