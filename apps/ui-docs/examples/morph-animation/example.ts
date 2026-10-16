import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Morph: Animation",
  summary: "animation tunes the house motion (duration, friction) or turns it off; reduced motion always jumps.",
  tags: ["morph", "buttons", "motion"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#morph-anim-off", "data-animation", "disabled"] }, { click: "#morph-anim-off-view" }, { matches: "#morph-anim-off[data-open]" }],
});
