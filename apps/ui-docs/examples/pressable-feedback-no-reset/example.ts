import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Progress Without Reset",
  summary: "autoReset={false} keeps the completed state.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#pf-noreset",
    },
    {
      attr: ["#pf-noreset .pressable-feedback__progress-feedback", "data-complete", "true"],
    },
  ],
});
