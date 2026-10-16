import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Sizes",
  summary: "size sm / md / lg scales the pill, the buttons and the value.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"matches": ".number-stepper--sm"}, {"matches": ".number-stepper--lg"}],
});
