import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: With Label",
  summary: "Label and Description outside the group label the input; without them pass aria-label.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"name": ["input", "Players"]}, {"described": ["input", "six per table"]}],
});
